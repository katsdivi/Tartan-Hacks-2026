import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";
import * as chatSchema from "../shared/models/chat";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema: { ...schema, ...chatSchema } });

async function main() {
  console.log("Seeding database...");

  // Create a user
  const [user] = await db
    .insert(schema.users)
    .values({
      username: "dummyuser",
      password: "password",
    })
    .returning();

  console.log("Created user:", user);

  // Create a conversation
  const [conversation] = await db
    .insert(chatSchema.conversations)
    .values({
      title: "My First Conversation",
    })
    .returning();

  console.log("Created conversation:", conversation);

  // Create messages
  const messagesToInsert = [
    {
      conversationId: conversation.id,
      role: "user",
      content: "Hello, I need some financial advice.",
    },
    {
      conversationId: conversation.id,
      role: "model",
      content: "Of course! I'm here to help. What's on your mind?",
    },
    {
      conversationId: conversation.id,
      role: "user",
      content: "I want to start a budget, but I don't know where to begin.",
    },
  ];

  const insertedMessages = await db
    .insert(chatSchema.messages)
    .values(messagesToInsert)
    .returning();

  console.log("Created messages:", insertedMessages);

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
