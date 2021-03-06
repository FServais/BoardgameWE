'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('EventAttendees', {
      id_event: {
        type: Sequelize.INTEGER,
        references: { model: 'Events', key: 'id' }
      },
      id_user: {
        type: Sequelize.INTEGER,
        references: { model: 'Users', key: 'id' }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }).then(() => {
      return queryInterface.addConstraint('EventAttendees', ['id_user', 'id_event'], {
        type: 'primary key',
        name: 'event_attendees_pkey'
      });
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('EventAttendees');
  }
};