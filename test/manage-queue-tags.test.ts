import { describe, it, expect, afterAll } from "vitest";
import { TagQueueCommand, ListQueueTagsCommand, UntagQueueCommand, CreateQueueCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server, cli } = await createServerAndCli();

describe("Manage Queue Tags", () => {
  afterAll(() => {
    server.close();
  });
  it("(SDK) should tag queue", async () => {
    const QueueName = randomUUID();
    await client.send(new CreateQueueCommand({ QueueName }));

    await client.send(new TagQueueCommand({ QueueUrl: QueueName, Tags: { hello: "world", env: "prod" } }));
  });

  it("(CLI) should tag queue", async () => {
    const QueueName = randomUUID();
    await client.send(new CreateQueueCommand({ QueueName }));
    await cli(`tag-queue --queue-url ${QueueName} --tags cliValue=test`);
  });

  it("(SDK) should list queue tags", async () => {
    const QueueName = randomUUID();
    await client.send(new CreateQueueCommand({ QueueName }));

    await client.send(new TagQueueCommand({ QueueUrl: QueueName, Tags: { hello: "world", env: "prod", cliValue: "test" } }));

    const cmd = new ListQueueTagsCommand({ QueueUrl: QueueName });
    const res = await client.send(cmd);
    expect(res.Tags).deep.eq({ hello: "world", env: "prod", cliValue: "test" });
  });

  it("(CLI) should list queue tags", async () => {
    const QueueName = randomUUID();
    await client.send(new CreateQueueCommand({ QueueName }));

    await client.send(new TagQueueCommand({ QueueUrl: QueueName, Tags: { hello: "world", env: "prod", cliValue: "test" } }));

    const res = JSON.parse((await cli(`list-queue-tags --queue-url ${QueueName}`)) as string);
    expect(res.Tags).deep.eq({ hello: "world", env: "prod", cliValue: "test" });
  });

  it("(SDK) should untag queue", async () => {
    const QueueName = randomUUID();
    await client.send(new CreateQueueCommand({ QueueName }));
    await client.send(new TagQueueCommand({ QueueUrl: QueueName, Tags: { hello: "world", env: "prod" } }));

    await client.send(new UntagQueueCommand({ QueueUrl: QueueName, TagKeys: ["hello"] }));
    const cmd = new ListQueueTagsCommand({ QueueUrl: QueueName });
    const res = await client.send(cmd);
    expect(res.Tags).deep.eq({ env: "prod" });
  });

  it("(CLI) should untag queue", async () => {
    const QueueName = randomUUID();
    await client.send(new CreateQueueCommand({ QueueName }));
    await client.send(new TagQueueCommand({ QueueUrl: QueueName, Tags: { env: "prod", cliValue: "test" } }));

    await cli(`untag-queue --queue-url ${QueueName} --tag-keys cliValue`);
    const cmd = new ListQueueTagsCommand({ QueueUrl: QueueName });
    const res = await client.send(cmd);
    expect(res.Tags).deep.eq({ env: "prod" });
  });
});
