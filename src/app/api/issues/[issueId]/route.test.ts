import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from './route';
import { createMockContext, mockIssue, mockUser, mockOrganization } from '~/test/mockContext';

// Mock the database
jest.mock('~/server/db', () => ({
  db: {
    issue: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock auth
jest.mock('~/server/auth', () => ({
  auth: jest.fn(),
}));

// Mock subdomain resolution
jest.mock('~/server/api/subdomain', () => ({
  resolveOrganizationFromSubdomain: jest.fn(),
}));

const mockAuth = require('~/server/auth').auth;
const mockDb = require('~/server/db').db;
const mockResolveOrg = require('~/server/api/subdomain').resolveOrganizationFromSubdomain;

describe('/api/issues/[issueId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveOrg.mockResolvedValue(mockOrganization);
  });

  describe('GET /api/issues/[issueId]', () => {
    it('should return issue details for authenticated users', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const issueWithDetails = {
        ...mockIssue,
        machine: {
          id: 'machine-1',
          serialNumber: 'TEST123',
          model: {
            name: 'Test Game',
            manufacturer: 'Test Manufacturer',
          },
          location: {
            name: 'Test Location',
          },
        },
        status: {
          id: 'status-1',
          name: 'Open',
          color: '#ff0000',
        },
        priority: {
          id: 'priority-1',
          name: 'Medium',
          color: '#ffa500',
        },
        createdBy: mockUser,
        assignedTo: null,
        comments: [],
        attachments: [],
        activities: [],
      };

      mockDb.issue.findUnique.mockResolvedValue(issueWithDetails);
      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:read' },
          ],
        },
      });

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1');
      const response = await GET(request, { params: { issueId: 'test-issue-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('issue-1');
      expect(data.title).toBe('Test Issue');
      expect(data.machine).toBeDefined();
      expect(data.status).toBeDefined();
      expect(data.priority).toBeDefined();
    });

    it('should return limited issue details for unauthenticated users', async () => {
      mockAuth.mockResolvedValue(null);

      const publicIssue = {
        ...mockIssue,
        machine: {
          id: 'machine-1',
          serialNumber: 'TEST123',
          model: {
            name: 'Test Game',
            manufacturer: 'Test Manufacturer',
          },
          location: {
            name: 'Test Location',
          },
        },
        status: {
          id: 'status-1',
          name: 'Open',
          color: '#ff0000',
        },
        priority: {
          id: 'priority-1',
          name: 'Medium',
          color: '#ffa500',
        },
        createdBy: mockUser,
        assignedTo: null,
        comments: [
          {
            id: 'comment-1',
            content: 'Public comment',
            isInternal: false,
            createdBy: mockUser,
            createdAt: new Date(),
          },
          {
            id: 'comment-2',
            content: 'Internal comment',
            isInternal: true,
            createdBy: mockUser,
            createdAt: new Date(),
          },
        ],
        attachments: [],
        activities: [],
      };

      mockDb.issue.findUnique.mockResolvedValue(publicIssue);

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1');
      const response = await GET(request, { params: { issueId: 'test-issue-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('issue-1');
      expect(data.title).toBe('Test Issue');
      // Should filter out internal comments
      expect(data.comments).toHaveLength(1);
      expect(data.comments[0].content).toBe('Public comment');
      // Should not include sensitive data
      expect(data.assignedTo).toBeUndefined();
    });

    it('should return 404 for non-existent issues', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.issue.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/issues/non-existent');
      const response = await GET(request, { params: { issueId: 'non-existent' } });

      expect(response.status).toBe(404);
    });

    it('should enforce organization isolation', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const otherOrgIssue = {
        ...mockIssue,
        organizationId: 'other-org-id',
      };

      mockDb.issue.findUnique.mockResolvedValue(otherOrgIssue);
      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
      });

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1');
      const response = await GET(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(404);
    });

    it('should handle database errors gracefully', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.issue.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1');
      const response = await GET(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/issues/[issueId]', () => {
    it('should update issue for users with edit permissions', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:edit' },
          ],
        },
      });

      mockDb.issue.findUnique.mockResolvedValue(mockIssue);

      const updatedIssue = {
        ...mockIssue,
        title: 'Updated Issue Title',
        description: 'Updated description',
      };

      mockDb.issue.update.mockResolvedValue(updatedIssue);

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Updated Issue Title',
          description: 'Updated description',
        }),
      });

      const response = await PUT(request, { params: { issueId: 'test-issue-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('Updated Issue Title');
      expect(data.description).toBe('Updated description');
    });

    it('should deny updates for users without edit permissions', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:read' },
          ],
        },
      });

      mockDb.issue.findUnique.mockResolvedValue(mockIssue);

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Updated Issue Title',
        }),
      });

      const response = await PUT(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(403);
    });

    it('should require authentication for updates', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Updated Issue Title',
        }),
      });

      const response = await PUT(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(401);
    });

    it('should validate request body', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:edit' },
          ],
        },
      });

      mockDb.issue.findUnique.mockResolvedValue(mockIssue);

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'PUT',
        body: JSON.stringify({
          title: '', // Empty title should be invalid
        }),
      });

      const response = await PUT(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(400);
    });

    it('should handle status updates with validation', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:edit' },
          ],
        },
      });

      mockDb.issue.findUnique.mockResolvedValue(mockIssue);

      const updatedIssue = {
        ...mockIssue,
        statusId: 'status-in-progress',
        status: {
          id: 'status-in-progress',
          name: 'In Progress',
          color: '#ffa500',
        },
      };

      mockDb.issue.update.mockResolvedValue(updatedIssue);

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'PUT',
        body: JSON.stringify({
          statusId: 'status-in-progress',
        }),
      });

      const response = await PUT(request, { params: { issueId: 'test-issue-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.statusId).toBe('status-in-progress');
    });

    it('should handle assignment updates', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:assign' },
          ],
        },
      });

      mockDb.issue.findUnique.mockResolvedValue(mockIssue);

      const updatedIssue = {
        ...mockIssue,
        assignedToId: 'user-2',
        assignedTo: {
          id: 'user-2',
          name: 'Another User',
          email: 'another@example.com',
        },
      };

      mockDb.issue.update.mockResolvedValue(updatedIssue);

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'PUT',
        body: JSON.stringify({
          assignedToId: 'user-2',
        }),
      });

      const response = await PUT(request, { params: { issueId: 'test-issue-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.assignedToId).toBe('user-2');
    });
  });

  describe('DELETE /api/issues/[issueId]', () => {
    it('should delete issue for users with delete permissions', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:delete' },
          ],
        },
      });

      mockDb.issue.findUnique.mockResolvedValue(mockIssue);
      mockDb.issue.delete.mockResolvedValue(mockIssue);

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(204);
    });

    it('should deny deletion for users without delete permissions', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:read' },
          ],
        },
      });

      mockDb.issue.findUnique.mockResolvedValue(mockIssue);

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(403);
    });

    it('should require authentication for deletion', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent issues', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:delete' },
          ],
        },
      });

      mockDb.issue.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/issues/non-existent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { issueId: 'non-existent' } });

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in request body', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:edit' },
          ],
        },
      });

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'PUT',
        body: 'invalid json',
      });

      const response = await PUT(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(400);
    });

    it('should handle database constraint violations', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:edit' },
          ],
        },
      });

      mockDb.issue.findUnique.mockResolvedValue(mockIssue);
      mockDb.issue.update.mockRejectedValue(new Error('Foreign key constraint failed'));

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'PUT',
        body: JSON.stringify({
          assignedToId: 'non-existent-user',
        }),
      });

      const response = await PUT(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(400);
    });

    it('should handle concurrent modification errors', async () => {
      mockAuth.mockResolvedValue({
        user: mockUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockDb.membership.findFirst.mockResolvedValue({
        userId: mockUser.id,
        organizationId: mockOrganization.id,
        role: {
          permissions: [
            { name: 'issues:edit' },
          ],
        },
      });

      mockDb.issue.findUnique.mockResolvedValue(mockIssue);
      mockDb.issue.update.mockRejectedValue(new Error('Record was updated by another process'));

      const request = new NextRequest('http://localhost:3000/api/issues/test-issue-1', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Updated title',
        }),
      });

      const response = await PUT(request, { params: { issueId: 'test-issue-1' } });

      expect(response.status).toBe(409);
    });
  });
});