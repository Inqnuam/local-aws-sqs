import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { AddPermissionCommand, CreateQueueCommand, GetQueueAttributesCommand, RemovePermissionCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";

const { client, server } = await createServerAndCli();

const QueueUrl = "RemovePermissionsQueue";

describe("Remove Permission", () => {
  afterAll(() => {
    server.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
  });

  it("should fail without Label", async () => {
    await expect(async () => {
      // @ts-expect-error
      await client.send(new RemovePermissionCommand({ QueueUrl }));
    }).rejects.toThrow("The request must contain the parameter Label.");
  });

  it("should fail with empty Label", async () => {
    await expect(async () => {
      await client.send(new RemovePermissionCommand({ QueueUrl, Label: "" }));
    }).rejects.toThrow("The request must contain the parameter Label.");
  });

  it("should fail with inexisting Statement", async () => {
    await expect(async () => {
      await client.send(new RemovePermissionCommand({ QueueUrl, Label: "InvalidPermissionLabel" }));
    }).rejects.toThrow("Value InvalidPermissionLabel for parameter Label is invalid. Reason: can't find label on existing policy.");
  });

  it("should remove existing permission", async () => {
    await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
    await client.send(new RemovePermissionCommand({ QueueUrl, Label: "Permission1" }));
    const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["Policy"] }));

    expect(res.Attributes).toBeUndefined();
  });
});
