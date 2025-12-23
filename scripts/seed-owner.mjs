import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const { MONGODB_URI, OWNER_EMAIL, OWNER_PASSWORD, OWNER_FULL_NAME } =
  process.env;

if (!MONGODB_URI || !OWNER_EMAIL || !OWNER_PASSWORD || !OWNER_FULL_NAME) {
  console.error("Missing required env vars for seeding owner.");
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI, { dbName: "research_os" });

  const UserSchema = new mongoose.Schema(
    {
      email: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true },
      fullName: { type: String, required: true },
      globalRole: { type: String, required: true },
    },
    { timestamps: true }
  );

  const User = mongoose.models.User ?? mongoose.model("User", UserSchema);

  const existing = await User.findOne({ email: OWNER_EMAIL }).lean();
  if (existing) {
    console.log("Owner already exists.");
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
  await User.create({
    email: OWNER_EMAIL,
    passwordHash,
    fullName: OWNER_FULL_NAME,
    globalRole: "Owner",
  });

  console.log("Owner created.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
