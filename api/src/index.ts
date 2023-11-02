import { ApolloServer } from "@apollo/server";
import { typeDefs } from "./graphql/typeDefs";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import express from "express";
import cors from "cors";
import { json } from "body-parser";
import { PrismaClient } from "@prisma/client";
import session from "express-session";
import passport from "passport";
import googlePassportConfig from "./lib/passport";
import authRoute from "./route/auth";
import { PubSub, withFilter } from "graphql-subscriptions";
import { createServer } from "http";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";

type User = {
  id?: string;
};

export const prisma = new PrismaClient();

const app = express();
const httpServer = createServer(app);

app.use(cors());

const pubsub = new PubSub();

(async function () {
  const resolvers = {
    Query: {
      getAllUsers: async () => {
        return await prisma.user.findMany();
      },
      getAllRooms: async () => {
        return await prisma.room.findMany();
      },
      getRoomData: async (_: any, args: any) => {
        const { roomId } = args;
        return await prisma.room.findUnique({
          where: {
            id: roomId,
          },
          select: {
            id: true,
            name: true,
            description: true,
            messages: {
              orderBy: {
                createdAt: "asc",
              },
              select: {
                id: true,
                body: true,
                createdAt: true,
                sender: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        });
      },
      getUserData: async (_: any, args: any) => {
        const { friendId, myId } = args;
        const userData = await prisma.user.findUnique({
          where: {
            id: friendId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        });

        const uniqueMessage = await prisma.message.findMany({
          where: {
            OR: [
              {
                AND: [
                  {
                    senderId: myId,
                  },
                  {
                    receiverId: friendId,
                  },
                ],
              },
              {
                AND: [
                  {
                    senderId: friendId,
                  },
                  {
                    receiverId: myId,
                  },
                ],
              },
            ],
          },
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            body: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
        return { ...userData, messages: uniqueMessage };
      },
    },
    Mutation: {
      createRoom: async (_: any, args: any) => {
        const { name, description } = args;
        return await prisma.room.create({
          data: {
            name,
            description,
          },
          select: {
            id: true,
            name: true,
            description: true,
            messages: {
              select: {
                id: true,
                body: true,
              },
            },
          },
        });
      },
      createMessage: async (_: any, args: any) => {
        const { body, roomId, senderId } = args;
        const messageResponse = await prisma.message.create({
          data: {
            body,
            senderId,
            roomId,
          },
          select: {
            id: true,
            body: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            room: {
              select: {
                id: true,
              },
            },
          },
        });
        pubsub.publish(`messageSent ${roomId}`, {
          messageSent: messageResponse,
        });
        return messageResponse;
      },
      createMessagebyUser: async (_: any, args: any, context: any) => {
        const { body, receiverId, senderId } = args;
        const messageResponse = await prisma.message.create({
          data: {
            body,
            receiverId,
            senderId,
          },
          select: {
            id: true,
            body: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            receiver: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
        pubsub.publish(`messageSentToUser ${receiverId}`, {
          messageSentToUser: messageResponse,
        });
        return messageResponse;
      },
    },
    Subscription: {
      messageSent: {
        subscribe: async (_: any, args: any, context: any) => {
          const { roomId } = args;
          return pubsub.asyncIterator(`messageSent ${roomId}`);
        },
      },
      messageSentToUser: {
        subscribe: withFilter(
          (_: any, args: any, context: any) => {
            return pubsub.asyncIterator(`messageSentToUser`);
          },
          async (payload, args) => {
            const { receiverId } = args;
            const { messageSentToUser } = payload;
            if (
              messageSentToUser.receiver.id === receiverId ||
              messageSentToUser.sender.id === receiverId
            ) {
              return true;
            }
            return false;
          }
        ),
      },
    },
  };

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql/subscription",
  });
  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  app.use(
    "/graphql",
    cors<cors.CorsRequest>(),
    json(),
    expressMiddleware(server, {
      context: async ({ req }) => ({ token: req.headers.token }),
    })
  );

  app.use(
    session({
      secret: "secretcode",
      resave: true,
      saveUninitialized: true,
      cookie: {
        sameSite: "none",
        secure: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // One Week
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: User, done) => {
    console.log(user);
    return done(null, user.id);
  });

  passport.deserializeUser((user: User, done) => {
    // Whatever we return goes to the client and binds to the req.user property
    return done(null, user);
  });

  googlePassportConfig();

  app.use("/auth", authRoute);

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: 4000 }, resolve)
  );
  console.log(`🚀 Server ready at http://localhost:4000/graphql`);
})();
