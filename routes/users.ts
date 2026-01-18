import { FastifyInstance } from 'fastify';
import { UserController } from '../controllers/UserController';

export default async function userRoutes(fastify: FastifyInstance) {
    // POST /users/signup - Create new user (Unprotected)
    fastify.post('/users/signup', UserController.signup);

    // POST /users/login - Login user
    fastify.post('/users/login', UserController.login);
}
