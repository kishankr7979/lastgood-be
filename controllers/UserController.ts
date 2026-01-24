import { FastifyRequest, FastifyReply } from 'fastify';
import { UserModel } from '../models/Users';
import jwt from 'jsonwebtoken';
import config from '../config/environment';
import { OrganizationModel } from '../models/Organization';
import { ApiKeyModel } from '../models/ApiKey';

export class UserController {
    // Signup - Unprotected
    static async signup(
        request: FastifyRequest<{
            Body: {
                email: string;
                password: string;
                role?: string;
                org_name: string;
                org_slug: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const { email, password, role, org_name, org_slug } = request.body;

            // Validate input
            if (!email || !password) {
                return reply.code(400).send({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid email format'
                });
            }

            // Password strength check
            if (password.length < 6) {
                return reply.code(400).send({
                    success: false,
                    message: 'Password must be at least 6 characters long'
                });
            }

            const userModel = new UserModel(request.server);

            const orgModel = new OrganizationModel(request.server);

            const apiKeyModel = new ApiKeyModel(request.server);

            // Check if user already exists
            const existingUser = await userModel.findByEmail(email);
            if (existingUser) {
                return reply.code(409).send({
                    success: false,
                    message: 'User with this email already exists'
                });
            }

            const orgId = crypto.randomUUID();

            const org = await orgModel.create({
                id: orgId,
                name: org_name.trim(),
                slug: org_slug,
                plan: 'free'
            })


            // Create user
            const user = await userModel.create({
                email,
                password,
                org_id: orgId,
                role
            });


            const defaultApiKey = await apiKeyModel.createDefaultKey(
                org.id,
                org.name
            );

            // Remove password_hash from response
            const { password_hash, ...userWithoutPassword } = user;

            return reply.code(201).send({
                success: true,
                data: {
                    user: userWithoutPassword,
                    org,
                    apiKey: defaultApiKey
                },
                message: 'User created successfully'
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // Login
    static async login(
        request: FastifyRequest<{
            Body: {
                email: string;
                password: string;
            }
        }>,
        reply: FastifyReply
    ) {
        try {
            const { email, password } = request.body;

            // Validate input
            if (!email || !password) {
                return reply.code(400).send({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            const userModel = new UserModel(request.server);

            // Find user
            const user = await userModel.findByEmail(email);
            if (!user) {
                return reply.code(401).send({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            // Verify password
            const isPasswordValid = await userModel.verifyPassword(password, user.password_hash);
            if (!isPasswordValid) {
                return reply.code(401).send({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    orgId: user.org_id,
                    role: user.role
                },
                config.security.jwtSecret as string,
                {
                    expiresIn: config.security.jwtExpiresIn as string
                } as jwt.SignOptions
            );

            // Remove password_hash from response
            const { password_hash, ...userWithoutPassword } = user;

            return reply.code(200).send({
                success: true,
                data: {
                    user: userWithoutPassword,
                    token
                },
                message: 'Login successful'
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    static async resetTempPassword(request: FastifyRequest<{
        Body: {
            id: string;
            password: string;
        }
    }>,
        reply: FastifyReply) {
        try {
            const { id, password } = request.body;
            const userModel = new UserModel(request.server);

            if (!id || !password) {
                return reply.code(400).send({
                    success: false,
                    message: 'ID and password are required'
                });
            }

            // Update the user's password
            await userModel.resetPassword({
                id,
                org_id: request?.organization_id,
                new_password: password
            });

            return reply.code(200).send({
                success: true,
                message: 'Password updated successfully'
            });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: error || 'Internal server error'
            });
        }
    }
}
