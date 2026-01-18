export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export class ResponseView {
    static success<T>(data: T, message?: string): ApiResponse<T> {
        return {
            success: true,
            data,
            message
        };
    }

    static error(message: string, error?: string): ApiResponse {
        return {
            success: false,
            message,
            error
        };
    }

    static notFound(message: string = 'Resource not found'): ApiResponse {
        return {
            success: false,
            message
        };
    }

    static badRequest(message: string = 'Bad request'): ApiResponse {
        return {
            success: false,
            message
        };
    }

    static serverError(message: string = 'Internal server error'): ApiResponse {
        return {
            success: false,
            message
        };
    }
}