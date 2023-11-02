import { gql } from "graphql-tag";

export const typeDefs = gql`
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
