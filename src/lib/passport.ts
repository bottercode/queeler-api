import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const googlePassportConfig = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: `${process.env.GOOGLE_CLIENT_ID}`,
        clientSecret: `${process.env.GOOGLE_CLIENT_SECRET}`,
        callbackURL: "http://localhost:4000/auth/google/callback",
      },
      function (_: any, __: any, profile: any, cb: any) {
        return cb(null, profile);
      }
    )
  );
};

export default googlePassportConfig;
