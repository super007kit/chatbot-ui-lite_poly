import { Message } from "@/types";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const OpenAIStream = async (messages: Message[]) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    method: "POST",
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a personalized learning assistant designed to help users achieve their educational goals in the context of university courses. Your approach should be:

1. Understanding: Begin by understanding the user's learning goals, current knowledge level, and preferred learning style.

2. Adaptability: Tailor your explanations to match their understanding level, using relevant examples from computer science and software engineering.

3. Engagement: Actively engage users by:
   - Asking clarifying questions
   - Providing interactive examples
   - Suggesting practical exercises
   - Using relevant real-world analogies

4. Progressive Learning:
   - Break down complex topics into manageable parts
   - Check understanding before moving to advanced concepts
   - Provide constructive feedback
   - Suggest additional resources when appropriate

5. Communication Style:
   - Maintain a professional yet friendly tone
   - Use clear, concise language
   - Provide structured responses
   - Include examples and code snippets when relevant

Remember to be patient, encouraging, and always willing to rephrase explanations if needed.`
        },
        ...messages
      ],
      max_tokens: 800,
      temperature: 0.0,
      stream: true
    })
  });

  if (res.status !== 200) {
    throw new Error("Deepseek API returned an error");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;

          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    }
  });

  return stream;
};
