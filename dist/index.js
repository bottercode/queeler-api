"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const server_1 = require("@apollo/server");
const typeDefs_1 = require("./graphql/typeDefs");
const express4_1 = require("@apollo/server/express4");
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = require("body-parser");
const client_1 = require("@prisma/client");
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const passport_2 = __importDefault(require("./lib/passport"));
const auth_1 = __importDefault(require("./route/auth"));
const graphql_subscriptions_1 = require("graphql-subscriptions");
const http_1 = require("http");
const schema_1 = require("@graphql-tools/schema");
const ws_1 = require("ws");
const ws_2 = require("graphql-ws/lib/use/ws");
exports.prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
app.use((0, cors_1.default)());
const pubsub = new graphql_subscriptions_1.PubSub();
(async function () {
    const resolvers = {
        Query: {
            getAllUsers: async () => {
                return await exports.prisma.user.findMany();
            },
            getAllRooms: async () => {
                return await exports.prisma.room.findMany();
            },
            getRoomData: async (_, args) => {
                const { roomId } = args;
                return await exports.prisma.room.findUnique({
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
            getUserData: async (_, args) => {
                const { friendId, myId } = args;
                const userData = await exports.prisma.user.findUnique({
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
                const uniqueMessage = await exports.prisma.message.findMany({
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
                return Object.assign(Object.assign({}, userData), { messages: uniqueMessage });
            },
        },
        Mutation: {
            createRoom: async (_, args) => {
                const { name, description } = args;
                return await exports.prisma.room.create({
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
            createMessage: async (_, args) => {
                const { body, roomId, senderId } = args;
                const messageResponse = await exports.prisma.message.create({
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
            createMessagebyUser: async (_, args, context) => {
                const { body, receiverId, senderId } = args;
                const messageResponse = await exports.prisma.message.create({
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
                subscribe: async (_, args, context) => {
                    const { roomId } = args;
                    return pubsub.asyncIterator(`messageSent ${roomId}`);
                },
            },
            messageSentToUser: {
                subscribe: (0, graphql_subscriptions_1.withFilter)((_, args, context) => {
                    return pubsub.asyncIterator(`messageSentToUser`);
                }, async (payload, args) => {
                    const { receiverId } = args;
                    const { messageSentToUser } = payload;
                    if (messageSentToUser.receiver.id === receiverId ||
                        messageSentToUser.sender.id === receiverId) {
                        return true;
                    }
                    return false;
                }),
            },
        },
    };
    const schema = (0, schema_1.makeExecutableSchema)({ typeDefs: typeDefs_1.typeDefs, resolvers });
    const wsServer = new ws_1.WebSocketServer({
        server: httpServer,
        path: "/graphql/subscription",
    });
    const serverCleanup = (0, ws_2.useServer)({ schema }, wsServer);
    const server = new server_1.ApolloServer({
        schema,
        plugins: [
            (0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer }),
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
    app.use("/graphql", (0, cors_1.default)(), (0, body_parser_1.json)(), (0, express4_1.expressMiddleware)(server, {
        context: async ({ req }) => ({ token: req.headers.token }),
    }));
    app.use((0, express_session_1.default)({
        secret: "secretcode",
        resave: true,
        saveUninitialized: true,
        cookie: {
            sameSite: "none",
            secure: true,
            maxAge: 1000 * 60 * 60 * 24 * 7,
        },
    }));
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    passport_1.default.serializeUser((user, done) => {
        console.log(user);
        return done(null, user.id);
    });
    passport_1.default.deserializeUser((user, done) => {
        return done(null, user);
    });
    (0, passport_2.default)();
    app.use("/auth", auth_1.default);
    await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));
    console.log(`🚀 Server ready at http://localhost:4000/graphql`);
})();
//# sourceMappingURL=index.js.map