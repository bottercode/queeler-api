import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "http://localhost:3000" }),
  async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { email: req.user.emails[0].value },
        select: { id: true, email: true, name: true, avatar: true },
      });
      if (user) {
        const token = jwt.sign(user, `${process.env.JWT_SECRET}`, {
          expiresIn: "7days",
        });
        res.cookie("cookie", token); // Sets cookie
      } else {
        const newUser = await prisma.user.create({
          data: {
            email: req.user.emails[0].value,
            name: req.user.displayName,
            avatar: req.user.photos[0].value,
          },
          select: { id: true, email: true, name: true, avatar: true },
        });
        console.log(newUser);
        const token = jwt.sign(newUser, `${process.env.JWT_SECRET}`, {
          expiresIn: "7days",
        });
        res.cookie("cookie", token); // Sets cookie
      }
    } catch (error) {
      console.log(error);
    }

    res.redirect("http://localhost:3000/chat");
  }
);

export default router;
