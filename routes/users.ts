import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/UserController';
import { authenticateJWT } from '../middleware/auth';

export default async function userRoutes(fastify: FastifyInstance) {
    // POST /users/signup - Create new user (Unprotected)
    fastify.post('/users/signup', UserController.signup);

    // POST /users/login - Login user
    fastify.post('/users/login', UserController.login);


    fastify.post('/users/password/reset', UserController.resetTempPassword)
}
