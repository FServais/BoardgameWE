'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        const timeData = {
            createdAt: Sequelize.literal("(now() at time zone 'utc')"),
            updatedAt: Sequelize.literal("(now() at time zone 'utc')")
        };
        return queryInterface.bulkInsert('FriendshipRequests', [
            {id_user_to: 2, id_user_from: 6, status: 'ACCEPTED', ...timeData },
            {id_user_to: 2, id_user_from: 5, status: 'PENDING', ...timeData }
        ], {});
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('FriendshipRequests', null, {});
    }
};
