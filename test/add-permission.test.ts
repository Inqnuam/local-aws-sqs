import { describe, it, expect, afterAll, beforeAll } from "vitest";

import { AddPermissionCommand, CreateQueueCommand, GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";

const { client, server, cli } = await createServerAndCli();

describe("Add Permission", () => {
  afterAll(() => {
    server?.close();
  });

  describe("Should fail", () => {
    const QueueUrl = "FailAddPermissionsQueue";

    beforeAll(async () => {
      await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
    });

    it("without Actions", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new AddPermissionCommand({ QueueUrl, AWSAccountIds: ["123456789012"], Label: "Permission1" }));
      }).rejects.toThrow("The request must contain the parameter ActionName.");
    });

    it("with empty Actions", async () => {
      await expect(async () => {
        await client.send(new AddPermissionCommand({ QueueUrl, Actions: [], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
      }).rejects.toThrow("The request must contain the parameter ActionName.");
    });

    it("with invalid Actions", async () => {
      await expect(async () => {
        await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessageBatch"], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
      }).rejects.toThrow("Value SQS:SendMessageBatch for parameter ActionName is invalid. Reason: Please refer to the appropriate WSDL for a list of valid actions.");
    });

    it("with forbidden Actions", async () => {
      await expect(async () => {
        await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["CreateQueue"], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
      }).rejects.toThrow("Value SQS:CreateQueue for parameter ActionName is invalid. Reason: Only the queue owner is allowed to invoke this action.");
    });

    it("without AWSAccountIds", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], Label: "Permission1" }));
      }).rejects.toThrow("The request must contain the parameter AWSAccountIds.");
    });

    it("with empty AWSAccountIds", async () => {
      await expect(async () => {
        await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], AWSAccountIds: [], Label: "Permission1" }));
      }).rejects.toThrow("The request must contain the parameter AWSAccountIds.");
    });

    it("without Label", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], AWSAccountIds: ["123456789012"] }));
      }).rejects.toThrow("The request must contain the parameter Label.");
    });

    it("without empty Label", async () => {
      await expect(async () => {
        await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], AWSAccountIds: ["123456789012"], Label: "" }));
      }).rejects.toThrow("The request must contain the parameter Label.");
    });

    it("with same Label and different Statement", async () => {
      await expect(async () => {
        await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
        await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["DeleteMessage"], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
      }).rejects.toThrow("Value Permission1 for parameter Label is invalid. Reason: Already exists.");
    });

    it("with over statement limit", async () => {
      await expect(async () => {
        let i = 1;

        while (i < 22) {
          await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], AWSAccountIds: ["123456789012"], Label: `Label${i}` }));
          i++;
        }
      }).rejects.toThrow("21 Statements were found, maximum allowed is 20.");
    });
  });

  describe("Should pass", () => {
    const QueueUrl = "PassAddPermissionsQueue";
    const Permission = { QueueUrl, Actions: ["SendMessage"], AWSAccountIds: ["123456789012"], Label: "Permission1" };

    beforeAll(async () => {
      await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
    });

    it("with a new Permission", async () => {
      await client.send(new AddPermissionCommand(Permission));

      const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["Policy"] }));

      expect(res.Attributes?.Policy).toBe(
        '{"Id":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue/SQSDefaultPolicy","Version":"2012-10-17","Statement":{"Sid":"Permission1","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::123456789012:root"},"Action":"SQS:SendMessage","Resource":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue"}}'
      );
    });

    it("with a same exact Permission", async () => {
      await client.send(new AddPermissionCommand(Permission));

      const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["Policy"] }));

      expect(res.Attributes?.Policy).toBe(
        '{"Id":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue/SQSDefaultPolicy","Version":"2012-10-17","Statement":{"Sid":"Permission1","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::123456789012:root"},"Action":"SQS:SendMessage","Resource":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue"}}'
      );
    });

    it("with multiple statements", async () => {
      await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage", "DeleteMessage"], AWSAccountIds: ["123456789012"], Label: "Permission2" }));

      const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["Policy"] }));

      expect(res.Attributes?.Policy).toBe(
        '{"Id":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue/SQSDefaultPolicy","Version":"2012-10-17","Statement":[{"Sid":"Permission1","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::123456789012:root"},"Action":"SQS:SendMessage","Resource":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue"},{"Sid":"Permission2","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::123456789012:root"},"Action":["SQS:SendMessage","SQS:DeleteMessage"],"Resource":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue"}]}'
      );
    });

    it("with CLI", async () => {
      await cli(`add-permission --queue-url ${QueueUrl} --label CliPermission --aws-account-ids 123456789012 --actions SendMessage`);

      const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["Policy"] }));
      expect(res.Attributes?.Policy).toBe(
        '{"Id":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue/SQSDefaultPolicy","Version":"2012-10-17","Statement":[{"Sid":"Permission1","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::123456789012:root"},"Action":"SQS:SendMessage","Resource":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue"},{"Sid":"Permission2","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::123456789012:root"},"Action":["SQS:SendMessage","SQS:DeleteMessage"],"Resource":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue"},{"Sid":"CliPermission","Effect":"Allow","Principal":{"AWS":"arn:aws:iam::123456789012:root"},"Action":"SQS:SendMessage","Resource":"arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsQueue"}]}'
      );
    });
    const Statement = {
      Sid: "Queue1_SendMessage",
      Effect: "Allow",
      Principal: {
        AWS: ["123456789012"],
      },
      Action: "sqs:SendMessage",
      Resource: "arn:aws:sqs:us-east-1:123456789012:queue1",
    };
    it("by adding to existing Queue Policy (with object statement)", async () => {
      const QueueUrl = "PassAddPermissionsToQueuePolicyObjectStatement";

      const Policy = JSON.stringify({ Version: "2012-10-17", Statement });
      await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { Policy } }));

      await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["DeleteMessage"], AWSAccountIds: ["123456789012"], Label: "CustomPermissionDeleteMessage" }));

      const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["Policy"] }));

      expect(res.Attributes!.Policy!).toBe(
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            Statement,
            {
              Sid: "CustomPermissionDeleteMessage",
              Effect: "Allow",
              Principal: { AWS: "arn:aws:iam::123456789012:root" },
              Action: "SQS:DeleteMessage",
              Resource: "arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsToQueuePolicyObjectStatement",
            },
          ],
        })
      );
    });

    it("by adding to existing Queue Policy (with array statement)", async () => {
      const QueueUrl = "PassAddPermissionsToQueuePolicyArrayStatement";

      const Policy = JSON.stringify({ Version: "2012-10-17", Statement: [Statement] });
      await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { Policy } }));

      await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["DeleteMessage"], AWSAccountIds: ["123456789012"], Label: "CustomPermissionDeleteMessage" }));

      const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["Policy"] }));

      expect(res.Attributes!.Policy!).toBe(
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            Statement,
            {
              Sid: "CustomPermissionDeleteMessage",
              Effect: "Allow",
              Principal: { AWS: "arn:aws:iam::123456789012:root" },
              Action: "SQS:DeleteMessage",
              Resource: "arn:aws:sqs:us-east-1:123456789012:PassAddPermissionsToQueuePolicyArrayStatement",
            },
          ],
        })
      );
    });
  });
});
