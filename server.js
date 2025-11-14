const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Подключение к базе данных
const pool = new Pool({
    user: process.env.DB_USER || 'pleh',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'user',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// Проверка подключения к БД
pool.connect((err, client, release) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err.stack);
    } else {
        console.log('Успешное подключение к базе данных');
        release();
    }
});

// Модель пользователя
class UserModel {
    constructor(pool) {
        this.pool = pool;
    }

    async getAllUsers(limit = 100, offset = 0) {
        try {
            const query = `
                SELECT * FROM users 
                ORDER BY created_at DESC 
                LIMIT $1 OFFSET $2
            `;
            const result = await this.pool.query(query, [limit, offset]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    async getUserById(id) {
        try {
            const query = 'SELECT * FROM users WHERE id = $1';
            const result = await this.pool.query(query, [id]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async getUserByEmail(email) {
        try {
            const query = 'SELECT * FROM users WHERE email = $1';
            const result = await this.pool.query(query, [email]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async getUserByUsername(username) {
        try {
            const query = 'SELECT * FROM users WHERE username = $1';
            const result = await this.pool.query(query, [username]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async createUser(userData) {
        const { username, email, first_name, last_name } = userData;

        try {
            const query = `
                INSERT INTO users (username, email, first_name, last_name) 
                VALUES ($1, $2, $3, $4) 
                RETURNING *
            `;
            const result = await this.pool.query(query, [username, email, first_name, last_name]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async updateUser(id, userData) {
        const { username, email, first_name, last_name, is_active } = userData;

        try {
            const query = `
                UPDATE users 
                SET username = $1, email = $2, first_name = $3, last_name = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
                WHERE id = $6 
                RETURNING *
            `;
            const result = await this.pool.query(query, [username, email, first_name, last_name, is_active, id]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    async deleteUser(id) {
        try {
            const query = 'DELETE FROM users WHERE id = $1 RETURNING *';
            const result = await this.pool.query(query, [id]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }
}

const userModel = new UserModel(pool);

// Контроллеры
const userController = {
    async getAllUsers(req, res) {
        try {
            const { limit = 100, offset = 0 } = req.query;
            const users = await userModel.getAllUsers(parseInt(limit), parseInt(offset));

            res.json({
                success: true,
                data: users,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: users.length
                }
            });
        } catch (error) {
            console.error('Ошибка при получении пользователей:', error);
            res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
    },

    async getUserById(req, res) {
        try {
            const { id } = req.params;
            const user = await userModel.getUserById(parseInt(id));

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Пользователь не найден'
                });
            }

            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            console.error('Ошибка при получении пользователя:', error);
            res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
    },

    async createUser(req, res) {
        try {
            const { username, email, first_name, last_name } = req.body;

            if (!username || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'Username и email обязательны для заполнения'
                });
            }

            const existingUserByEmail = await userModel.getUserByEmail(email);
            if (existingUserByEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Пользователь с таким email уже существует'
                });
            }

            const existingUserByUsername = await userModel.getUserByUsername(username);
            if (existingUserByUsername) {
                return res.status(400).json({
                    success: false,
                    message: 'Пользователь с таким username уже существует'
                });
            }

            const newUser = await userModel.createUser({
                username,
                email,
                first_name,
                last_name
            });

            res.status(201).json({
                success: true,
                message: 'Пользователь успешно создан',
                data: newUser
            });
        } catch (error) {
            console.error('Ошибка при создании пользователя:', error);
            res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
    },

    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const { username, email, first_name, last_name, is_active } = req.body;

            const existingUser = await userModel.getUserById(parseInt(id));
            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Пользователь не найден'
                });
            }

            if (email && email !== existingUser.email) {
                const userWithEmail = await userModel.getUserByEmail(email);
                if (userWithEmail) {
                    return res.status(400).json({
                        success: false,
                        message: 'Пользователь с таким email уже существует'
                    });
                }
            }

            if (username && username !== existingUser.username) {
                const userWithUsername = await userModel.getUserByUsername(username);
                if (userWithUsername) {
                    return res.status(400).json({
                        success: false,
                        message: 'Пользователь с таким username уже существует'
                    });
                }
            }

            const updatedUser = await userModel.updateUser(parseInt(id), {
                username: username || existingUser.username,
                email: email || existingUser.email,
                first_name: first_name !== undefined ? first_name : existingUser.first_name,
                last_name: last_name !== undefined ? last_name : existingUser.last_name,
                is_active: is_active !== undefined ? is_active : existingUser.is_active
            });

            res.json({
                success: true,
                message: 'Пользователь успешно обновлен',
                data: updatedUser
            });
        } catch (error) {
            console.error('Ошибка при обновлении пользователя:', error);
            res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
    },

    async deleteUser(req, res) {
        try {
            const { id } = req.params;

            const deletedUser = await userModel.deleteUser(parseInt(id));

            if (!deletedUser) {
                return res.status(404).json({
                    success: false,
                    message: 'Пользователь не найден'
                });
            }

            res.json({
                success: true,
                message: 'Пользователь успешно удален',
                data: deletedUser
            });
        } catch (error) {
            console.error('Ошибка при удалении пользователя:', error);
            res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
    }
};

// Роуты
app.get('/', (req, res) => {
    res.json({
        message: 'User Management API',
        version: '1.0.0',
        endpoints: {
            'GET /users': 'Получить всех пользователей',
            'GET /users/:id': 'Получить пользователя по ID',
            'POST /users': 'Создать нового пользователя',
            'PUT /users/:id': 'Обновить пользователя',
            'DELETE /users/:id': 'Удалить пользователя'
        }
    });
});

app.get('/users', userController.getAllUsers);
app.get('/users/:id', userController.getUserById);
app.post('/users', userController.createUser);
app.put('/users/:id', userController.updateUser);
app.delete('/users/:id', userController.deleteUser);

// Обработка 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Маршрут не найден'
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`API доступно по адресу: http://localhost:${PORT}/`);
});