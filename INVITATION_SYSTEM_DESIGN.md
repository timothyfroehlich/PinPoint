# PinPoint User Invitation & Onboarding System Design

## 🎯 Design Principles

**For Non-Technical Users:**
- Familiar "Sign Up" and "Log In" buttons (even though they use the same flow)
- Simple, clear language without tech jargon
- One-page onboarding with minimal friction
- Admin-controlled role assignment (no user role selection)

**For Admins:**
- Easy team member invitation from dashboard
- Role assignment during invitation
- Clear invitation status tracking

## 🏗️ System Architecture

### **Database Schema**

```sql
-- New Invitation table
model Invitation {
  id              String        @id @default(cuid())
  email           String
  organizationId  String
  invitedBy       String        // userId who sent invite
  role            String        // role to assign when user joins
  token           String        @unique
  status          InvitationStatus @default(PENDING)
  message         String?       // optional personal message
  expiresAt       DateTime
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  organization    Organization  @relation(fields: [organizationId], references: [id])
  inviter         User          @relation(fields: [invitedBy], references: [id])
  
  @@unique([email, organizationId])
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

-- User table additions
model User {
  // ...existing fields...
  onboardingCompleted Boolean   @default(false)
  invitedBy           String?   // track who invited them
  sentInvitations     Invitation[] @relation("UserInvitations")
}
```

### **URL Structure & Routing**

```typescript
// Current org-specific auth
apc.pinpoint.com/sign-in     // "Log In to Austin Pinball Collective"
apc.pinpoint.com/sign-up     // "Join Austin Pinball Collective"

// Invitation flows
apc.pinpoint.com/auth/invite?token=xyz123&email=user@example.com
apc.pinpoint.com/onboarding  // First-time user setup

// Admin areas
apc.pinpoint.com/dashboard/team/invite    // Send invitations
apc.pinpoint.com/dashboard/team           // Manage team & invitations
```

## 🎨 User Experience Flows

### **Flow 1: Admin Invites New User**

**Admin Experience:**
1. Dashboard → "Team" → "Invite Member" button
2. Form: Email, Role (dropdown), Optional message
3. Click "Send Invitation" → Email sent with branded invite

**New User Experience:**
1. Receives email: "Tim invited you to join Austin Pinball Collective"
2. Clicks "Accept Invitation" → Magic link with invitation context
3. Auto-creates account + assigns role + joins organization
4. Redirects to onboarding: "Welcome to Austin Pinball Collective!"
5. Simple form: Name, maybe phone number for notifications
6. "Get Started" → Dashboard with role-appropriate permissions

### **Flow 2: Organic Sign-Up (via org subdomain)**

**User sees org branding immediately:**
1. User visits `apc.pinpoint.com`
2. Sees "Join Austin Pinball Collective" button
3. Clicks → Same magic link flow
4. Auto-assigns default "Member" role
5. Onboarding: "Welcome! You're joining Austin Pinball Collective"
6. Admin gets notification: "New member joined and needs role assignment"

### **Flow 3: Returning User**

1. Visits any auth page
2. Clicks "Log In" 
3. Standard magic link flow
4. Direct to dashboard (skips onboarding)

## 🔧 Technical Implementation

### **Invitation System Core**

```typescript
// Invitation service
export class InvitationService {
  async createInvitation(params: {
    email: string;
    organizationId: string;
    invitedBy: string;
    role: string;
    message?: string;
  }) {
    const token = generateSecureToken();
    const expiresAt = addDays(new Date(), 7); // 7-day expiry
    
    const invitation = await db.invitation.create({
      data: { ...params, token, expiresAt }
    });
    
    await this.sendInvitationEmail(invitation);
    return invitation;
  }
  
  async acceptInvitation(token: string, userEmail: string) {
    const invitation = await this.validateInvitation(token, userEmail);
    
    // Auto-assign user to organization with specified role
    await db.membership.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        roleId: invitation.role,
      }
    });
    
    await db.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' }
    });
  }
}
```

### **Enhanced NextAuth Configuration**

```typescript
// Enhanced auth providers with invitation context
export function createResendProvider(): Provider | null {
  return Resend({
    // ... existing config ...
    sendVerificationRequest: async ({ identifier: email, url, provider }) => {
      // Check for invitation context in URL
      const urlObj = new URL(url);
      const invitationToken = urlObj.searchParams.get('invitation');
      
      if (invitationToken) {
        // Send invitation-specific email template
        await sendInvitationEmail(email, url, invitationToken);
      } else {
        // Send standard magic link email
        await sendStandardAuthEmail(email, url);
      }
    }
  });
}

// Auth callbacks to handle invitation acceptance
export const authConfig = {
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      // Check for invitation context during sign-in
      const invitation = await checkPendingInvitation(user.email);
      
      if (invitation) {
        await acceptInvitation(invitation.token, user.email);
        // Mark user as needing onboarding
        await markUserForOnboarding(user.id, invitation.organizationId);
      }
      
      return true;
    }
  }
};
```

## 🎨 UI Components Design

### **Admin Invitation Interface**

```typescript
// Team management page
function TeamInvitePage() {
  return (
    <Card>
      <CardHeader>
        <Typography variant="h5">Invite Team Member</Typography>
        <Typography variant="body2" color="text.secondary">
          Send an invitation to join Austin Pinball Collective
        </Typography>
      </CardHeader>
      
      <CardContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label="Email Address"
            type="email"
            required
            placeholder="colleague@example.com"
          />
          
          <FormControl>
            <InputLabel>Role</InputLabel>
            <Select defaultValue="member">
              <MenuItem value="admin">Administrator</MenuItem>
              <MenuItem value="technician">Technician</MenuItem>
              <MenuItem value="member">Member</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            label="Personal Message (Optional)"
            multiline
            rows={3}
            placeholder="Welcome to the team! Looking forward to working with you."
          />
          
          <Button variant="contained" size="large">
            Send Invitation
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
```

### **Simple Onboarding Flow**

```typescript
function OnboardingPage() {
  return (
    <Container maxWidth="sm">
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Welcome to Austin Pinball Collective! 🎯
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Just a few quick details to get you started
        </Typography>
        
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label="Full Name"
            required
            placeholder="Enter your full name"
          />
          
          <TextField
            label="Phone Number (Optional)"
            placeholder="For important notifications"
            helperText="We'll only use this for urgent machine alerts"
          />
          
          <FormControlLabel
            control={<Checkbox />}
            label="I'd like to receive email notifications about machine issues"
          />
          
          <Button variant="contained" size="large" sx={{ mt: 2 }}>
            Get Started
          </Button>
        </Box>
      </Card>
    </Container>
  );
}
```

### **Enhanced Sign-In Page**

```typescript
// Updated sign-in page with better messaging
function SignInPage() {
  const orgName = "Austin Pinball Collective"; // From subdomain
  
  return (
    <Card>
      <CardHeader>
        <Typography variant="h4">
          Welcome to {orgName}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Sign in to manage machines and track issues
        </Typography>
      </CardHeader>
      
      <CardContent>
        {/* Magic link form (existing) */}
        
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button variant="outlined" fullWidth size="large">
            Log In
          </Button>
          <Button variant="contained" fullWidth size="large">
            Join {orgName}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
```

## 📊 Implementation Priority

### **Phase 1: Core Invitation System (Critical for 1.0)**
1. ✅ Database schema migration
2. ✅ Invitation service with token generation  
3. ✅ Enhanced NextAuth callbacks for invitation handling
4. ✅ Admin invitation UI
5. ✅ Basic onboarding page

### **Phase 2: UX Polish (Nice-to-have for 1.0)**  
6. ✅ Sign Up/Log In button variants
7. ✅ Invitation email templates with branding
8. ✅ Invitation status tracking for admins
9. ✅ Welcome messaging customization

### **Phase 3: Future Enhancements (Post-1.0)**
- Generic signup (non-org specific)
- Multiple organization support
- Advanced onboarding workflows
- Invitation link sharing features

## 🔒 Security Considerations

- **Invitation tokens**: Cryptographically secure, 7-day expiry
- **Email verification**: Existing magic link security applies
- **Role validation**: Admin-only role assignment, server-side validation
- **Org scoping**: All invitations scoped to organization context
- **Audit trail**: Track who invited whom, when, and role changes

This design provides a familiar UX for non-technical users while maintaining the modern passwordless security you've already implemented!