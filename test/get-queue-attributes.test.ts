import { describe, it, expect, afterAll } from "vitest";
import { GetQueueAttributesCommand, CreateQueueCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { cli, client, server } = await createServerAndCli();

const attribs = { MaximumMessageSize: "1048576", VisibilityTimeout: "30" };

describe("Get Queue Attributes", () => {
  afterAll(() => {
    server.close();
  });

  it("(SDK) Should get specified attributes", async () => {
    const QueueName = randomUUID();
    await client.send(new CreateQueueCommand({ QueueName }));

    const cmd = new GetQueueAttributesCommand({ QueueUrl: QueueName, AttributeNames: ["MaximumMessageSize", "VisibilityTimeout"] });

    const res = await client.send(cmd);

    expect(res.Attributes).deep.eq(attribs);
  });

  it("(CLI) Should get specified attributes", async () => {
    const QueueName = randomUUID();
    await client.send(new CreateQueueCommand({ QueueName }));
    const res = (await cli(`get-queue-attributes --queue-url ${QueueName} --attribute-names MaximumMessageSize VisibilityTimeout`)) as string;

    expect(JSON.parse(res).Attributes).deep.eq(attribs);
  });
});
