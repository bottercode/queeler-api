"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeDefs = void 0;
const graphql_tag_1 = require("graphql-tag");
exports.typeDefs = (0, graphql_tag_1.gql) `
  type User {
    id: String
    name: String
    email: String
    avatar: String
  }

  type Message {
    id: String
    body: String
    sender: User
    room: Room
    createdAt: String
    receiver: User
  }

  type Room {
    id: String
    name: String
    messages: [Message]
    description: String
  }

  type UserData {
    id: String
    name: String
    email: String
    avatar: String
    messages: [Message]
  }

  type Query {
    getAllUsers: [User]
    getAllRooms: [Room]
    getRoomData(roomId: String!): Room
    getUserData(friendId: String!, myId: String!): UserData
  }

  type Subscription {
    messageSent(roomId: String!): Message
    messageSentToUser(receiverId: String): Message
  }

  type Mutation {
    createRoom(name: String!, description: String!): Room
    createMessage(body: String!, roomId: String!, senderId: String!): Message
    createMessagebyUser(
      body: String!
      receiverId: String!
      senderId: String!
    ): Message
  }
`;
//# sourceMappingURL=typeDefs.js.map