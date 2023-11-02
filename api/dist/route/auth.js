"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = express_1.default.Router();
router.get("/google", passport_1.default.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport_1.default.authenticate("google", { failureRedirect: "http://localhost:3000" }), async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { email: req.user.emails[0].value },
            select: { id: true, email: true, name: true, avatar: true },
        });
        if (user) {
            const token = jsonwebtoken_1.default.sign(user, `${process.env.JWT_SECRET}`, {
                expiresIn: "7days",
            });
            res.cookie("cookie", token);
        }
        else {
            const newUser = await prisma.user.create({
                data: {
                    email: req.user.emails[0].value,
                    name: req.user.displayName,
                    avatar: req.user.photos[0].value,
                },
                select: { id: true, email: true, name: true, avatar: true },
            });
            console.log(newUser);
            const token = jsonwebtoken_1.default.sign(newUser, `${process.env.JWT_SECRET}`, {
                expiresIn: "7days",
            });
            res.cookie("cookie", token);
        }
    }
    catch (error) {
        console.log(error);
    }
    res.redirect("http://localhost:3000/chat");
});
exports.default = router;
//# sourceMappingURL=auth.js.map