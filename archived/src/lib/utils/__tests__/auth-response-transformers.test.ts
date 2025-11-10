import {
  transformUserResponse,
  transformOrganizationResponse,
  transformMembershipResponse,
  transformUploadAuthContextResponse,
  transformAuthUserProfile,
  transformUserArray,
  transformMembershipArray,
  transformOrganizationArray,
} from "../auth-response-transformers";

describe("Auth Response Transformers", () => {
  describe("transformUserResponse", () => {
    it("should transform user object from snake_case to camelCase", () => {
      const dbUser = {
        id: "user1",
        email: "test@example.com",
        name: "Test User",
        image: "avatar.jpg",
        email_verified: new Date("2023-01-01"),
        notification_frequency: "daily",
        email_notifications_enabled: true,
        push_notifications_enabled: false,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-01-02"),
      };

      const result = transformUserResponse(dbUser);

      expect(result).toEqual({
        id: "user1",
        email: "test@example.com",
        name: "Test User",
        image: "avatar.jpg",
        emailVerified: new Date("2023-01-01"),
        notificationFrequency: "daily",
        emailNotificationsEnabled: true,
        pushNotificationsEnabled: false,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-02"),
      });
    });

    it("should handle null values correctly", () => {
      const dbUser = {
        id: "user1",
        email: "test@example.com",
        name: null,
        image: null,
        email_verified: null,
        notification_frequency: null,
        email_notifications_enabled: true,
        push_notifications_enabled: true,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-01-02"),
      };

      const result = transformUserResponse(dbUser);

      expect(result.name).toBeNull();
      expect(result.image).toBeNull();
      expect(result.emailVerified).toBeNull();
      expect(result.notificationFrequency).toBeNull();
    });
  });

  describe("transformOrganizationResponse", () => {
    it("should transform organization object from snake_case to camelCase", () => {
      const dbOrg = {
        id: "org1",
        name: "Test Organization",
        subdomain: "test-org",
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-01-02"),
      };

      const result = transformOrganizationResponse(dbOrg);

      expect(result).toEqual({
        id: "org1",
        name: "Test Organization",
        subdomain: "test-org",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-02"),
      });
    });
  });

  describe("transformMembershipResponse", () => {
    it("should transform membership object with nested user and role", () => {
      const dbMembership = {
        id: "membership1",
        user_id: "user1",
        organization_id: "org1",
        role_id: "role1",
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-01-02"),
        user: {
          id: "user1",
          email: "test@example.com",
          name: "Test User",
          created_at: new Date("2023-01-01"),
        },
        role: {
          id: "role1",
          name: "Admin",
          role_permissions: [
            { permission: { name: "read" } },
            { permission: { name: "write" } },
          ],
        },
      };

      const result = transformMembershipResponse(dbMembership);

      expect(result.userId).toBe("user1");
      expect(result.organizationId).toBe("org1");
      expect(result.roleId).toBe("role1");
      expect(result.user?.email).toBe("test@example.com");
      expect(result.role?.name).toBe("Admin");
      expect(result.role?.permissions).toEqual([
        { name: "read" },
        { name: "write" },
      ]);
      expect(result.role?.rolePermissions).toBeUndefined();
    });

    it("should handle membership without nested relations", () => {
      const dbMembership = {
        id: "membership1",
        user_id: "user1",
        organization_id: "org1",
        role_id: "role1",
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-01-02"),
      };

      const result = transformMembershipResponse(dbMembership);

      expect(result.userId).toBe("user1");
      expect(result.organizationId).toBe("org1");
      expect(result.roleId).toBe("role1");
      expect(result.user).toBeUndefined();
      expect(result.role).toBeUndefined();
    });

    it("should handle direct permissions array", () => {
      const dbMembership = {
        id: "membership1",
        user_id: "user1",
        organization_id: "org1",
        role_id: "role1",
        role: {
          id: "role1",
          name: "Admin",
          permissions: [{ name: "read" }, { name: "write" }],
        },
      };

      const result = transformMembershipResponse(dbMembership);

      expect(result.role?.permissions).toEqual([
        { name: "read" },
        { name: "write" },
      ]);
    });
  });

  describe("transformUploadAuthContextResponse", () => {
    it("should transform complete upload auth context", () => {
      const dbCtx = {
        user: {
          id: "user1",
          email: "test@example.com",
          name: "Test User",
        },
        organization: {
          id: "org1",
          name: "Test Org",
          subdomain: "test",
          created_at: new Date("2023-01-01"),
        },
        membership: {
          id: "membership1",
          user_id: "user1",
          organization_id: "org1",
          role_id: "role1",
          role: {
            id: "role1",
            name: "Admin",
            permissions: [{ name: "upload" }],
          },
        },
        userPermissions: ["upload", "read"],
      };

      const result = transformUploadAuthContextResponse(dbCtx);

      expect(result.organization.createdAt).toEqual(new Date("2023-01-01"));
      expect(result.membership.userId).toBe("user1");
      expect(result.membership.organizationId).toBe("org1");
      expect(result.userPermissions).toEqual(["upload", "read"]);
    });

    it("should handle missing nested objects", () => {
      const dbCtx = {
        user: { id: "user1", email: "test@example.com" },
        userPermissions: undefined,
      };

      const result = transformUploadAuthContextResponse(dbCtx);

      expect(result.user.id).toBe("user1");
      expect(result.userPermissions).toEqual([]);
    });
  });

  describe("transformAuthUserProfile", () => {
    it("should transform auth user profile with profile picture", () => {
      const dbProfile = {
        id: "user1",
        name: "Test User",
        email: "test@example.com",
        image: "avatar.jpg",
        profile_picture: "profile.jpg",
      };

      const result = transformAuthUserProfile(dbProfile);

      expect(result.profilePicture).toBe("profile.jpg");
      expect(result.image).toBe("avatar.jpg");
    });

    it("should handle missing profile picture", () => {
      const dbProfile = {
        id: "user1",
        name: "Test User",
        email: "test@example.com",
        image: "avatar.jpg",
      };

      const result = transformAuthUserProfile(dbProfile);

      expect(result.image).toBe("avatar.jpg");
      expect(result.profilePicture).toBeUndefined();
    });

    it("should copy profile_picture to profilePicture when missing", () => {
      const dbProfile = {
        id: "user1",
        name: "Test User",
        email: "test@example.com",
        profile_picture: "profile.jpg",
      };

      const result = transformAuthUserProfile(dbProfile);

      expect(result.profilePicture).toBe("profile.jpg");
    });
  });

  describe("array transformation utilities", () => {
    describe("transformUserArray", () => {
      it("should transform array of users", () => {
        const dbUsers = [
          {
            id: "user1",
            email: "test1@example.com",
            created_at: new Date("2023-01-01"),
          },
          {
            id: "user2",
            email: "test2@example.com",
            created_at: new Date("2023-01-02"),
          },
        ];

        const result = transformUserArray(dbUsers);

        expect(result).toHaveLength(2);
        expect(result[0].createdAt).toEqual(new Date("2023-01-01"));
        expect(result[1].createdAt).toEqual(new Date("2023-01-02"));
      });

      it("should handle empty array", () => {
        const result = transformUserArray([]);
        expect(result).toEqual([]);
      });

      it("should handle invalid input", () => {
        const result = transformUserArray(null as any);
        expect(result).toEqual([]);
      });
    });

    describe("transformMembershipArray", () => {
      it("should transform array of memberships", () => {
        const dbMemberships = [
          {
            id: "membership1",
            user_id: "user1",
            organization_id: "org1",
          },
          {
            id: "membership2",
            user_id: "user2",
            organization_id: "org1",
          },
        ];

        const result = transformMembershipArray(dbMemberships);

        expect(result).toHaveLength(2);
        expect(result[0].userId).toBe("user1");
        expect(result[1].userId).toBe("user2");
      });
    });

    describe("transformOrganizationArray", () => {
      it("should transform array of organizations", () => {
        const dbOrgs = [
          {
            id: "org1",
            name: "Org 1",
            created_at: new Date("2023-01-01"),
          },
          {
            id: "org2",
            name: "Org 2",
            created_at: new Date("2023-01-02"),
          },
        ];

        const result = transformOrganizationArray(dbOrgs);

        expect(result).toHaveLength(2);
        expect(result[0].createdAt).toEqual(new Date("2023-01-01"));
        expect(result[1].createdAt).toEqual(new Date("2023-01-02"));
      });
    });
  });

  describe("edge cases", () => {
    it("should handle undefined input", () => {
      expect(() => transformUserResponse(undefined)).not.toThrow();
      expect(() => transformOrganizationResponse(undefined)).not.toThrow();
      expect(() => transformMembershipResponse(undefined)).not.toThrow();
    });

    it("should handle null input", () => {
      expect(() => transformUserResponse(null)).not.toThrow();
      expect(() => transformOrganizationResponse(null)).not.toThrow();
      expect(() => transformMembershipResponse(null)).not.toThrow();
    });

    it("should handle empty object input", () => {
      const result = transformUserResponse({});
      expect(typeof result).toBe("object");
    });

    it("should preserve Date objects", () => {
      const testDate = new Date("2023-01-01");
      const dbUser = {
        id: "user1",
        created_at: testDate,
        email_verified: testDate,
      };

      const result = transformUserResponse(dbUser);

      expect(result.createdAt).toBe(testDate);
      expect(result.emailVerified).toBe(testDate);
    });

    it("should handle mixed data types", () => {
      const dbUser = {
        id: "user1",
        email: "test@example.com",
        some_number: 42,
        some_boolean: true,
        some_array: ["item1", "item2"],
        some_object: { nested_field: "value" },
      };

      const result = transformUserResponse(dbUser) as any;

      expect(result.someNumber).toBe(42);
      expect(result.someBoolean).toBe(true);
      expect(result.someArray).toEqual(["item1", "item2"]);
      expect(result.someObject.nestedField).toBe("value");
    });
  });
});
