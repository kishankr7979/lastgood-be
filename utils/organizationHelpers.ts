import { FastifyRequest } from 'fastify';
import { Organization } from '../models/Organization';

// Type-safe helper to get organization ID from authenticated request
export function getOrgId(request: FastifyRequest): string {
    return request.getOrganizationId();
}

// Type-safe helper to get organization from authenticated request
export async function getOrg(request: FastifyRequest): Promise<Organization | null> {
    return await request.getOrganization();
}

// Type-safe helper to require organization from authenticated request
export async function requireOrg(request: FastifyRequest): Promise<Organization> {
    return await request.requireOrganization();
}

// Helper to check if organization has specific plan
export async function hasOrganizationPlan(
    request: FastifyRequest,
    requiredPlans: string[]
): Promise<boolean> {
    try {
        const organization = await request.getOrganization();
        return organization ? requiredPlans.includes(organization.plan) : false;
    } catch {
        return false;
    }
}

// Helper to get organization plan limits (example usage)
export async function getOrganizationLimits(request: FastifyRequest): Promise<{
    maxApiKeys: number;
    maxChangeEvents: number;
    retentionDays: number;
    advancedFeatures: boolean;
}> {
    const organization = await request.getOrganization();

    if (!organization) {
        throw new Error('Organization not found');
    }

    // Define limits based on plan
    switch (organization.plan) {
        case 'free':
            return {
                maxApiKeys: 2,
                maxChangeEvents: 1000,
                retentionDays: 30,
                advancedFeatures: false
            };
        case 'starter':
            return {
                maxApiKeys: 5,
                maxChangeEvents: 10000,
                retentionDays: 90,
                advancedFeatures: false
            };
        case 'pro':
            return {
                maxApiKeys: 20,
                maxChangeEvents: 100000,
                retentionDays: 365,
                advancedFeatures: true
            };
        case 'enterprise':
            return {
                maxApiKeys: -1, // unlimited
                maxChangeEvents: -1, // unlimited
                retentionDays: -1, // unlimited
                advancedFeatures: true
            };
        default:
            return {
                maxApiKeys: 1,
                maxChangeEvents: 100,
                retentionDays: 7,
                advancedFeatures: false
            };
    }
}

// Helper to format organization info for responses
export async function getOrganizationInfo(request: FastifyRequest): Promise<{
    id: string;
    name: string;
    slug: string | null;
    plan: string;
}> {
    const organization = await request.requireOrganization();

    return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan
    };
}