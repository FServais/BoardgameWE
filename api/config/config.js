
let database = {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOSTNAME,
    dialect: 'postgres',
    timezone: process.env.TIMEZONE || "UTC",
    seederStorage: "sequelize"
};

if (process.env.NODE_ENV !== "production") {
    database.logging = console.log;
} else {
    database.logging = false;
}

if (process.env.USE_SSL) {
    database.dialectOptions = {ssl: true};
}

module.exports = {
    jwt_secret_key: process.env.JWT_SECRET_KEY,
    jwt_duration: process.env.JWT_DURATION || "4 days",
    [process.env.NODE_ENV]: database
};