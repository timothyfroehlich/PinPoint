import { randomBytes } from "crypto";

import { addDays } from "date-fns";
import { Resend } from "resend";

import type { ExtendedPrismaClient } from "~/server/db";

import { env } from "~/env.js";

export interface CreateInvitationParams {
  email: string;
  organizationId: string;
  invitedBy: string;
  roleId: string;
  message?: string;
}

export interface InvitationWithDetails {
  id: string;
  email: string;
  organizationId: string;
  invitedBy: string;
  roleId: string;
  token: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  message?: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
    subdomain: string | null;
  };
  inviter: {
    id: string;
    name: string | null;
    email: string | null;
  };
  role: {
    id: string;
    name: string;
  };
}

/**
 * Service for managing user invitations to organizations
 */
export class InvitationService {
  constructor(private db: ExtendedPrismaClient) {}

  /**
   * Generate a cryptographically secure invitation token
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Create a new invitation and send email
   */
  async createInvitation(
    params: CreateInvitationParams,
  ): Promise<InvitationWithDetails> {
    const { email, organizationId, invitedBy, roleId, message } = params;

    // Check if user already has a membership in this organization
    const existingMembership = await this.db.membership.findFirst({
      where: {
        organizationId,
        user: { email },
      },
    });

    if (existingMembership) {
      throw new Error("User is already a member of this organization");
    }

    // Check if there's already a pending invitation
    const existingInvitation = await this.db.invitation.findFirst({
      where: {
        email,
        organizationId,
        status: "PENDING",
      },
    });

    if (existingInvitation) {
      throw new Error("There is already a pending invitation for this email");
    }

    // Generate secure token and expiry
    const token = this.generateSecureToken();
    const expiresAt = addDays(new Date(), 7); // 7-day expiry

    // Create the invitation - handle undefined message properly
    const createData = {
      email,
      organizationId,
      invitedBy,
      roleId,
      token,
      expiresAt,
      ...(message !== undefined && { message }),
    };

    const invitation = await this.db.invitation.create({
      data: createData,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Send invitation email
    try {
      await this.sendInvitationEmail(invitation);
    } catch (emailError) {
      // Log email error but don't fail the invitation creation
      console.error("Failed to send invitation email:", emailError);
    }

    return invitation;
  }

  /**
   * Send invitation email using Resend
   */
  private async sendInvitationEmail(
    invitation: InvitationWithDetails,
  ): Promise<void> {
    if (!env.RESEND_API_KEY) {
      console.warn("Resend API key not configured, skipping email");
      return;
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const baseUrl = env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : "http://localhost:3000";

    // Create invitation URL with token and email
    const invitationUrl = `${baseUrl}/auth/invite?token=${invitation.token}&email=${encodeURIComponent(invitation.email)}`;

    const inviterName =
      invitation.inviter.name ?? invitation.inviter.email ?? "Someone";
    const orgName = invitation.organization.name;

    const result = await resend.emails.send({
      from: "PinPoint <noreply@pinpoint.austinpinballcollective.org>",
      to: [invitation.email],
      subject: `${inviterName} invited you to join ${orgName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Join ${orgName}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #667eea; margin-bottom: 10px;">🎯 PinPoint</h1>
              <p style="color: #666; margin: 0;">Pinball Machine Management</p>
            </div>
            
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
              <h2 style="margin-top: 0; color: #333;">You're invited to join ${orgName}!</h2>
              <p style="color: #666; margin-bottom: 20px;">
                <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on PinPoint.
              </p>
              
              ${
                invitation.message
                  ? `
                <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; font-style: italic; color: #1976d2;">"${invitation.message}"</p>
                </div>
              `
                  : ""
              }
              
              <p style="color: #666; margin-bottom: 25px;">
                You'll be joining as a <strong>${invitation.role.name}</strong>. Click the button below to accept the invitation and get started.
              </p>
              
              <div style="text-align: center;">
                <a href="${invitationUrl}" style="display: inline-block; background-color: #667eea; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 500; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; text-align: center;">
              <p>If you don't want to join ${orgName}, you can safely ignore this email.</p>
              <p>This invitation will expire on ${invitation.expiresAt.toLocaleDateString()}.</p>
            </div>
          </body>
        </html>
      `,
      text: `
You're invited to join ${orgName}!

${inviterName} has invited you to join ${orgName} on PinPoint.

${invitation.message ? `Message: "${invitation.message}"` : ""}

You'll be joining as a ${invitation.role.name}. Click the link below to accept:
${invitationUrl}

This invitation will expire on ${invitation.expiresAt.toLocaleDateString()}.

If you don't want to join, you can safely ignore this email.
      `,
    });

    if (result.error) {
      throw new Error(
        `Failed to send invitation email: ${result.error.message}`,
      );
    }
  }

  /**
   * Validate and retrieve invitation by token and email
   */
  async validateInvitation(
    token: string,
    email: string,
  ): Promise<InvitationWithDetails> {
    const invitation = await this.db.invitation.findFirst({
      where: {
        token,
        email,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new Error("Invalid or expired invitation");
    }

    return invitation;
  }

  /**
   * Accept invitation and create user membership
   */
  async acceptInvitation(
    token: string,
    userEmail: string,
    userId: string,
  ): Promise<void> {
    const invitation = await this.validateInvitation(token, userEmail);

    // Check if user already has membership (double-check)
    const existingMembership = await this.db.membership.findFirst({
      where: {
        userId,
        organizationId: invitation.organizationId,
      },
    });

    if (existingMembership) {
      // Mark invitation as accepted anyway
      await this.db.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });
      return;
    }

    // Create membership and mark invitation as accepted
    await this.db.$transaction([
      this.db.membership.create({
        data: {
          userId,
          organizationId: invitation.organizationId,
          roleId: invitation.roleId,
        },
      }),
      this.db.user.update({
        where: { id: userId },
        data: {
          invitedBy: invitation.invitedBy,
          onboardingCompleted: false, // Mark for onboarding
        },
      }),
      this.db.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      }),
    ]);
  }

  /**
   * Get all invitations for an organization
   */
  async getOrganizationInvitations(
    organizationId: string,
  ): Promise<InvitationWithDetails[]> {
    return this.db.invitation.findMany({
      where: { organizationId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Revoke an invitation
   */
  async revokeInvitation(
    invitationId: string,
    organizationId: string,
  ): Promise<void> {
    await this.db.invitation.updateMany({
      where: {
        id: invitationId,
        organizationId,
        status: "PENDING",
      },
      data: {
        status: "REVOKED",
      },
    });
  }

  /**
   * Check if email has pending invitation for organization
   */
  async checkPendingInvitation(
    email: string,
  ): Promise<InvitationWithDetails | null> {
    return this.db.invitation.findFirst({
      where: {
        email,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
