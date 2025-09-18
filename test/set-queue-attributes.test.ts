import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { CreateQueueCommand, GetQueueAttributesCommand, SetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";
import { randomUUID } from "crypto";

const { client, server, cli } = await createServerAndCli();

const StandartQueueName = randomUUID();
const FifoQueueName = `${StandartQueueName}.fifo`;

describe("SetQueueAttributes", () => {
  afterAll(() => {
    server.close();
  });

  beforeAll(async () => {
    await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));
    await client.send(new CreateQueueCommand({ QueueName: FifoQueueName, Attributes: { FifoQueue: "true" } }));
  });

  describe("Standart Queue", () => {
    const RedriveAllowPolicy = JSON.stringify({ redrivePermission: "allowAll" });
    describe("Should fail", () => {
      const QueueUrl = "FailQueueSetQueueAttributes";
      beforeAll(async () => {
        await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
      });

      it("without Attributes", async () => {
        await expect(async () => {
          // @ts-expect-error
          await client.send(new SetQueueAttributesCommand({ QueueUrl }));
        }).rejects.toThrow("The request must contain the parameter Attribute.Name.");
      });

      it("with invalid Attributes type", async () => {
        await expect(async () => {
          // @ts-expect-error
          await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: [] }));
        }).rejects.toThrow("The request must contain the parameter Attribute.Name.");
      });
      it("with empty Attributes", async () => {
        await expect(async () => {
          await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: {} }));
        }).rejects.toThrow("The request must contain the parameter Attribute.Name.");
      });

      it("with invalid Attribute name", async () => {
        await expect(async () => {
          await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { FifoQueue: "true" } }));
        }).rejects.toThrow("Unknown Attribute FifoQueue.");
      });

      it("with invalid Attribute type (object)", async () => {
        await expect(async () => {
          // @ts-expect-error
          await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { DelaySeconds: {} } }));
        }).rejects.toThrow("Start of structure or map found where not expected.");
      });

      it("with invalid Attribute type (object)", async () => {
        await expect(async () => {
          // @ts-expect-error
          await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { DelaySeconds: [] } }));
        }).rejects.toThrow("Start of list found where not expected");
      });

      it("with invalid queue Attribute (FifoThroughputLimit)", async () => {
        await expect(async () => {
          await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { FifoThroughputLimit: "perQueue" } }));
        }).rejects.toThrow("You can specify the FifoThroughputLimit only when FifoQueue is set to true.");
      });

      it("with invalid queue Attribute (DeduplicationScope)", async () => {
        await expect(async () => {
          await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { DeduplicationScope: "messageGroup" } }));
        }).rejects.toThrow("You can specify the DeduplicationScope only when FifoQueue is set to true.");
      });

      it("with invalid queue Attribute (SqsManagedSseEnabled + KmsMasterKeyId)", async () => {
        await expect(async () => {
          await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { SqsManagedSseEnabled: "true", KmsMasterKeyId: "alias/aws/sqs" } }));
        }).rejects.toThrow("You can use one type of server-side encryption (SSE) at one time. You can either enable KMS SSE or SQS SSE.");
      });

      it("with invalid Policy Statement length", async () => {
        await expect(async () => {
          const Policy = JSON.stringify({
            Version: "2012-10-17",
            Statement: Array(22)
              .fill("")
              .map((x, i) => {
                return {
                  Sid: `Label${i + 1}`,
                  Effect: "Allow",
                  Principal: {
                    AWS: ["123456789012"],
                  },
                  Action: "sqs:SendMessage",
                  Resource: `arn:aws:sqs:us-east-1:123456789012:${QueueUrl}`,
                };
              }),
          });

          await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { Policy } }));
        }).rejects.toThrow("22 statements were found in the submitted policy, max allowed is 20");
      });

      //
    });
    describe("Should pass", () => {
      const QueueUrl = "PassQueueSetQueueAttributes";
      beforeAll(async () => {
        await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
      });

      it("with DelaySeconds", async () => {
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { DelaySeconds: "54" } }));

        const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["DelaySeconds"] }));

        expect(res.Attributes!.DelaySeconds).toBe("54");
      });

      it("with KmsMasterKeyId", async () => {
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { KmsMasterKeyId: "alias/aws/sqs" } }));

        const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));

        expect(res.Attributes!.KmsMasterKeyId).toBe("alias/aws/sqs");
        expect(res.Attributes!.KmsDataKeyReusePeriodSeconds).toBe("300"); // default value
        expect(res.Attributes!.SqsManagedSseEnabled).toBe("false");
      });

      it("with SqsManagedSseEnabled true", async () => {
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { SqsManagedSseEnabled: "true" } }));

        const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));

        expect(res.Attributes!.KmsMasterKeyId).toBeUndefined();
        expect(res.Attributes!.KmsDataKeyReusePeriodSeconds).toBeUndefined();
        expect(res.Attributes!.SqsManagedSseEnabled).toBe("true");
      });

      it("with SqsManagedSseEnabled false", async () => {
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { SqsManagedSseEnabled: "false" } }));

        const res1 = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["SqsManagedSseEnabled", "KmsMasterKeyId", "KmsDataKeyReusePeriodSeconds"] }));

        expect(res1.Attributes!.KmsMasterKeyId).toBeUndefined();
        expect(res1.Attributes!.KmsDataKeyReusePeriodSeconds).toBeUndefined();
        expect(res1.Attributes!.SqsManagedSseEnabled).toBe("false");

        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { KmsMasterKeyId: "alias/aws/sqs" } }));

        const res2 = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["SqsManagedSseEnabled", "KmsMasterKeyId", "KmsDataKeyReusePeriodSeconds"] }));

        expect(res2.Attributes!.KmsMasterKeyId).toBe("alias/aws/sqs");
        expect(res2.Attributes!.KmsDataKeyReusePeriodSeconds).toBe("300");
        expect(res2.Attributes!.SqsManagedSseEnabled).toBe("false");
      });

      const Statement = {
        Sid: "Queue1_SendMessage",
        Effect: "Allow",
        Principal: {
          AWS: ["123456789012"],
        },
        Action: "sqs:SendMessage",
        Resource: "arn:aws:sqs:us-east-1:123456789012:PassQueueSetQueueAttributes",
      };
      const Policy = JSON.stringify({ Version: "2012-10-17", Statement });

      it("with Policy", async () => {
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { Policy } }));
        const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["Policy"] }));
        expect(res.Attributes!.Policy).toBe(Policy);
      });

      it("with unset Policy", async () => {
        const beforeUnset = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["Policy"] }));
        expect(beforeUnset.Attributes!.Policy).toBe(Policy);
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { Policy: "" } }));

        const afterUnset = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["Policy"] }));
        expect(afterUnset.Attributes!).toBeUndefined();
      });

      it("with RedriveAllowPolicy", async () => {
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { RedriveAllowPolicy } }));
        const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["RedriveAllowPolicy"] }));
        expect(res.Attributes!.RedriveAllowPolicy).toBe(RedriveAllowPolicy);
      });

      it("with unset RedriveAllowPolicy", async () => {
        const beforeUnset = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["RedriveAllowPolicy"] }));
        expect(beforeUnset.Attributes!.RedriveAllowPolicy).toBe(RedriveAllowPolicy);
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { RedriveAllowPolicy: "" } }));

        const afterUnset = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["RedriveAllowPolicy"] }));
        expect(afterUnset.Attributes!).toBeUndefined();
      });

      const RedrivePolicy = JSON.stringify({ maxReceiveCount: 10, deadLetterTargetArn: `arn:aws:sqs:us-east-1:123456789012:${StandartQueueName}` });

      it("with RedrivePolicy", async () => {
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { RedrivePolicy } }));
        const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["RedrivePolicy"] }));
        expect(res.Attributes!.RedrivePolicy).toBe(RedrivePolicy);
      });

      it("with unset RedrivePolicy", async () => {
        const beforeUnset = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["RedrivePolicy"] }));
        expect(beforeUnset.Attributes!.RedrivePolicy).toBe(RedrivePolicy);
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { RedrivePolicy: "" } }));

        const afterUnset = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["RedrivePolicy"] }));
        expect(afterUnset.Attributes!).toBeUndefined();
      });
    });

    describe("[CLI]", () => {
      const QueueUrl = "CLIQueueSetQueueAttributes";

      beforeAll(async () => {
        await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy } }));
      });

      it("Should pass", async () => {
        const attribs = JSON.stringify({ DelaySeconds: "10" });
        await cli(`set-queue-attributes --queue-url ${QueueUrl} --attributes '${attribs}'`);

        const res = (await cli(`get-queue-attributes --queue-url ${QueueUrl} --attribute-names DelaySeconds RedriveAllowPolicy`)) as string;

        expect(JSON.parse(res).Attributes).deep.eq({ DelaySeconds: "10", RedriveAllowPolicy });
      });

      it("Should fail", async () => {
        await expect(async () => {
          const attribs = JSON.stringify({ RedriveAllowPolicy: JSON.stringify({ redrivePermission: "ALL" }) });
          await cli(`set-queue-attributes --queue-url ${QueueUrl} --attributes '${attribs}'`);
        });
      });
    });
  });

  describe("FIFO Queue", () => {
    describe("Should fail", () => {
      const QueueUrl = "FailFIFOQueueSetQueueAttributes.fifo";
      beforeAll(async () => {
        await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { FifoQueue: "true" } }));
      });

      it("with invalid FifoThroughputLimit", async () => {
        await expect(async () => {
          await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { FifoThroughputLimit: "perMessageGroupId" } }));
        }).rejects.toThrow("The perMessageGroupId value is allowed only when the value for DeduplicationScope is messageGroup");
      });
    });

    describe("Should pass", () => {
      const QueueUrl = "PassFIFOQueueSetQueueAttributes.fifo";
      beforeAll(async () => {
        await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { FifoQueue: "true" } }));
      });

      it("DeduplicationScope + FifoThroughputLimit ", async () => {
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { FifoThroughputLimit: "perMessageGroupId", DeduplicationScope: "messageGroup" } }));
        const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));

        expect(res.Attributes!.DeduplicationScope).toBe("messageGroup");
        expect(res.Attributes!.FifoThroughputLimit).toBe("perMessageGroupId");

        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { FifoThroughputLimit: "perQueue", DeduplicationScope: "queue" } }));
      });

      it("DeduplicationScope ", async () => {
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { DeduplicationScope: "messageGroup" } }));
        const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));

        expect(res.Attributes!.DeduplicationScope).toBe("messageGroup");
      });

      it("FifoThroughputLimit ", async () => {
        await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { FifoThroughputLimit: "perMessageGroupId" } }));
        const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));

        expect(res.Attributes!.FifoThroughputLimit).toBe("perMessageGroupId");
      });
    });
  });
});
