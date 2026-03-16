import { z } from "zod";

export const discordInteractionOptionSchema = z.object({
  name: z.string(),
  type: z.number().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional()
});

export const discordInteractionSchema = z.object({
  id: z.string(),
  application_id: z.string().optional(),
  type: z.number(),
  token: z.string().optional(),
  data: z
    .object({
      id: z.string().optional(),
      name: z.string(),
      type: z.number().optional(),
      options: z.array(discordInteractionOptionSchema).optional()
    })
    .optional(),
  user: z
    .object({
      id: z.string(),
      username: z.string().optional()
    })
    .optional(),
  member: z
    .object({
      user: z
        .object({
          id: z.string(),
          username: z.string().optional()
        })
        .optional()
    })
    .optional()
});

export type DiscordInteraction = z.infer<typeof discordInteractionSchema>;
