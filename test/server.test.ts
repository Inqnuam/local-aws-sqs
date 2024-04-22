import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createSqsServer } from "../src/";

import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  DeleteMessageBatchCommand,
  ChangeMessageVisibilityBatchCommand,
  ListQueuesCommand,
  ListQueueTagsCommand,
  ListDeadLetterSourceQueuesCommand,
  GetQueueAttributesCommand,
  CreateQueueCommand,
  DeleteQueueCommand,
  TagQueueCommand,
  UntagQueueCommand,
  GetQueueUrlCommand,
  SetQueueAttributesCommand,
  AddPermissionCommand,
  RemovePermissionCommand,
  StartMessageMoveTaskCommand,
  ListMessageMoveTasksCommand,
  CancelMessageMoveTaskCommand,
} from "@aws-sdk/client-sqs";
import child_process from "child_process";
import { randomUUID } from "crypto";

const PORT = 55323;
const AWS_ACCOUNT_ID = 123456789012;
const StandartQueueName = "MyQueue";
const FifoQueueName = "MyFifoQueue.fifo";

const client = new SQSClient({
  region: "us-east-1",
  endpoint: `http://localhost:${PORT}`,
  credentials: {
    accessKeyId: "fake",
    secretAccessKey: "fake",
  },
});

const sleep = (sec: number) => new Promise((resolve) => setTimeout(resolve, sec * 1000));

const cli = (cmd: string) => {
  return new Promise((resolve: Function, reject: Function) => {
    child_process.exec(`AWS_ACCESS_KEY_ID=fake AWS_SECRET_ACCESS_KEY=fake aws --region us-east-1 --endpoint http://localhost:${PORT} sqs ${cmd}`, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }
      if (stderr) {
        reject(stderr);
        return;
      }
      resolve(stdout);
    });
  });
};

let server: Awaited<ReturnType<typeof createSqsServer>>;

describe("SQS API", () => {
  afterAll(() => {
    server?.close();
  });

  beforeAll(async () => {
    server = await createSqsServer({ port: PORT });
  });

  describe("Create Queue", () => {
    describe("Should fail", () => {
      it("with missing QueueName", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new CreateQueueCommand({}));
        }).rejects.toThrow("Value for parameter QueueName is invalid. Reason: Must specify a queue name.");
      });

      it("with empty QueueName", () => {
        expect(async () => {
          await client.send(new CreateQueueCommand({ QueueName: "" }));
        }).rejects.toThrow("Queue name cannot be empty");
      });

      it("with invalid Standart Queue name", () => {
        expect(async () => {
          await client.send(new CreateQueueCommand({ QueueName: "example.fifo" }));
        }).rejects.toThrow("Can only include alphanumeric characters, hyphens, or underscores. 1 to 80 in length");
      });

      it("with invalid Standart Queue Attribute (FifoQueue)", () => {
        expect(async () => {
          await client.send(new CreateQueueCommand({ QueueName: "example", Attributes: { FifoQueue: "true" } }));
        }).rejects.toThrow("Unknown Attribute FifoQueue.");
      });

      it("with invalid FIFO Queue name", () => {
        expect(async () => {
          await client.send(new CreateQueueCommand({ QueueName: "example.ifo", Attributes: { FifoQueue: "true" } }));
        }).rejects.toThrow("Unknown Attribute FifoQueue.");
      });

      it("with invalid FIFO Queue Attribute", () => {
        expect(async () => {
          await client.send(new CreateQueueCommand({ QueueName: "example.fifo", Attributes: { FifoQueue: "false" } }));
        }).rejects.toThrow("Unknown Attribute FifoQueue.");
      });

      it("with invalid name", () => {
        expect(async () => {
          await client.send(new CreateQueueCommand({ QueueName: "in.fo" }));
        }).rejects.toThrow("Can only include alphanumeric characters, hyphens, or underscores. 1 to 80 in length");

        expect(async () => {
          await client.send(new CreateQueueCommand({ QueueName: "ééwwà)" }));
        }).rejects.toThrow("Can only include alphanumeric characters, hyphens, or underscores. 1 to 80 in length");
      });

      describe("with invalid Attributes type", () => {
        it("as array", () => {
          expect(async () => {
            // @ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttrib", Attributes: ["dummy"] }));
          }).rejects.toThrow("Unknown Attribute 0.");
        });

        it("as string", () => {
          expect(async () => {
            // @ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttrib", Attributes: "dummy" }));
          }).rejects.toThrow("Unknown Attribute 0.");
        });
      });
    });

    describe("Should pass", () => {
      it("Standart Queue", async () => {
        const res = await client.send(new CreateQueueCommand({ QueueName: StandartQueueName }));

        expect(res.$metadata.httpStatusCode).toBe(200);
        expect(res.QueueUrl).toBe(`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${StandartQueueName}`);
      });

      it("FIFO Queue", async () => {
        const res = await client.send(new CreateQueueCommand({ QueueName: FifoQueueName, Attributes: { FifoQueue: "true" } }));

        expect(res.$metadata.httpStatusCode).toBe(200);
        expect(res.QueueUrl).toBe(`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${FifoQueueName}`);
      });
    });

    describe("with custom Attributes", () => {
      describe("DelaySeconds", () => {
        describe("Should fail", () => {
          it("with object", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: {} } }));
            }).rejects.toThrow("Start of structure or map found where not expected.");
          });

          it("with array", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: [] } }));
            }).rejects.toThrow("Unrecognized collection type class java.lang.String");
          });

          it("with boolean", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: true } }));
            }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
          });
          it("with empty", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: "" } }));
            }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
          });

          it("with empty char and number", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: " 6" } }));
            }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
          });

          it("with signed int", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: "-45" } }));
            }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
          });

          it("with above max allowed value", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: "901" } }));
            }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
          });

          it("with float", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: "544.43" } }));
            }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
          });
        });

        describe("Should pass", () => {
          it("with null", async () => {
            const QueueUrl = "NullDelaySecondsQueue";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { DelaySeconds: null } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["DelaySeconds"] }));
            expect(res.Attributes!.DelaySeconds).toBe("0");
          });

          it("with String(Number)", async () => {
            const QueueUrl = "String500DelaySecondsQueue";
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { DelaySeconds: "500" } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["DelaySeconds"] }));
            expect(res.Attributes!.DelaySeconds).toBe("500");
          });

          it("with number", async () => {
            const QueueUrl = "Number400DelaySecondsQueue";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { DelaySeconds: 400 } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["DelaySeconds"] }));
            expect(res.Attributes!.DelaySeconds).toBe("400");
          });
          it("with string 0 (zero)", async () => {
            const QueueUrl = "StringZeroDelaySecondsQueue";
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { DelaySeconds: "0" } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["DelaySeconds"] }));
            expect(res.Attributes!.DelaySeconds).toBe("0");
          });

          it("with number 0 (zero)", async () => {
            const QueueUrl = "NumberZeroDelaySecondsQueue";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { DelaySeconds: 0 } }));
            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["DelaySeconds"] }));
            expect(res.Attributes!.DelaySeconds).toBe("0");
          });
        });
      });

      describe("MaximumMessageSize", () => {
        describe("Should fail", () => {
          it("with object", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: {} } }));
            }).rejects.toThrow("Start of structure or map found where not expected.");
          });

          it("with array", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: [] } }));
            }).rejects.toThrow("Unrecognized collection type class java.lang.String");
          });

          it("with boolean", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: true } }));
            }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
          });
          it("with empty", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: "" } }));
            }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
          });

          it("with empty char and number", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: " 2000" } }));
            }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
          });

          it("with below min allowed value", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: "1000" } }));
            }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
          });

          it("with above max allowed value", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: "262145" } }));
            }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
          });

          it("with float", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: "2000.43" } }));
            }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
          });
        });

        describe("Should pass", () => {
          it("with null", async () => {
            const QueueUrl = "NullMaximumMessageSize";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { MaximumMessageSize: null } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["MaximumMessageSize"] }));
            expect(res.Attributes!.MaximumMessageSize).toBe("262144");
          });

          it("with String(Number)", async () => {
            const QueueUrl = "String1024MaximumMessageSize";
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { MaximumMessageSize: "1024" } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["MaximumMessageSize"] }));
            expect(res.Attributes!.MaximumMessageSize).toBe("1024");
          });

          it("with number", async () => {
            const QueueUrl = "Number1024MaximumMessageSize";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { MaximumMessageSize: 1024 } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["MaximumMessageSize"] }));
            expect(res.Attributes!.MaximumMessageSize).toBe("1024");
          });
        });
      });

      describe("MessageRetentionPeriod", () => {
        describe("Should fail", () => {
          it("with object", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: {} } }));
            }).rejects.toThrow("Start of structure or map found where not expected.");
          });

          it("with array", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: [] } }));
            }).rejects.toThrow("Unrecognized collection type class java.lang.String");
          });

          it("with boolean", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: true } }));
            }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
          });
          it("with empty", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: "" } }));
            }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
          });

          it("with empty char and number", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: " 2000" } }));
            }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
          });

          it("with below min allowed value", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: "50" } }));
            }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
          });

          it("with above max allowed value", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: "1209601" } }));
            }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
          });

          it("with float", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: "65.2" } }));
            }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
          });
        });

        describe("Should pass", () => {
          it("with null", async () => {
            const QueueUrl = "NullMessageRetentionPeriod";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { MessageRetentionPeriod: null } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["MessageRetentionPeriod"] }));
            expect(res.Attributes!.MessageRetentionPeriod).toBe("345600");
          });

          it("with String(Number)", async () => {
            const QueueUrl = "String1024MessageRetentionPeriod";
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { MessageRetentionPeriod: "1024" } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["MessageRetentionPeriod"] }));
            expect(res.Attributes!.MessageRetentionPeriod).toBe("1024");
          });

          it("with number", async () => {
            const QueueUrl = "Number1024MessageRetentionPeriod";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { MessageRetentionPeriod: 1024 } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["MessageRetentionPeriod"] }));
            expect(res.Attributes!.MessageRetentionPeriod).toBe("1024");
          });
        });
      });

      describe("Policy", () => {
        const Statement = {
          Sid: "Queue1_SendMessage",
          Effect: "Allow",
          Principal: {
            AWS: ["123456789012"],
          },
          Action: "sqs:SendMessage",
          Resource: "arn:aws:sqs:us-east-1:123456789012:queue1",
        };

        describe("Should fail", () => {
          const QueueName = "FailQueuePolicy";

          it("with no JSON parsable string", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: "badjson" } }));
            }).rejects.toThrow("Invalid value for the parameter Policy.");
          });

          it("with invalid JSON Policy type (array)", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify([]) } }));
            }).rejects.toThrow("Invalid value for the parameter Policy.");
          });

          it("with invalid JSON Policy type (string)", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify("string") } }));
            }).rejects.toThrow("Invalid value for the parameter Policy.");
          });

          it("with invalid JSON Policy type (number)", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify(533) } }));
            }).rejects.toThrow("Invalid value for the parameter Policy.");
          });
          it("with invalid JSON Policy type (null)", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify(null) } }));
            }).rejects.toThrow("Invalid value for the parameter Policy.");
          });

          it("with unknown Policy field", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify({ Dummyfield: "dummyvalue", Version: "2012-10-17", Statement: [Statement] }) } })
              );
            }).rejects.toThrow("Invalid value for the parameter Policy.");
          });

          it("with invalid Policy Version", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify({ Version: "4532-10-17", Statement: [Statement] }) } }));
            }).rejects.toThrow("Invalid value for the parameter Policy.");
          });

          it("with empty Policy Statement", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify({ Version: "2012-10-17", Statement: [] }) } }));
            }).rejects.toThrow("Invalid value for the parameter Policy.");
          });

          it("with unknown Policy Statement (object) field", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify({ Version: "2012-10-17", Statement: { ...Statement, dummy: "value" } }) } })
              );
            }).rejects.toThrow("Invalid value for the parameter Policy.");
          });

          it("with unknown Policy Statement (array) field", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify({ Version: "2012-10-17", Statement: [{ ...Statement, dummy: "value" }] }) } })
              );
            }).rejects.toThrow("Invalid value for the parameter Policy.");
          });

          it("with invalid Policy Statement length", () => {
            expect(async () => {
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
                      Resource: `arn:aws:sqs:us-east-1:123456789012:${QueueName}`,
                    };
                  }),
              });

              await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy } }));
            }).rejects.toThrow("22 statements were found in the submitted policy, max allowed is 20");
          });
        });

        describe("Should pass", () => {
          it("with Version 2008", async () => {
            const QueueUrl = "QueuePolicyVersion2008";
            const Policy = JSON.stringify({ Version: "2008-10-17", Statement });
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { Policy } }));
            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));
            expect(res.Attributes!.Policy).toBe(Policy);
          });

          it("with Version 2012", async () => {
            const QueueUrl = "QueuePolicyVersion2012";
            const Policy = JSON.stringify({ Version: "2012-10-17", Statement });
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { Policy } }));
            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));
            expect(res.Attributes!.Policy).toBe(Policy);
          });

          it("with Policy Id", async () => {
            const QueueUrl = "QueuePolicyId";
            const Policy = JSON.stringify({ Id: "_some_id", Version: "2012-10-17", Statement });
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { Policy } }));
            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));
            expect(res.Attributes!.Policy).toBe(Policy);
          });

          it("with Statement Array", async () => {
            const QueueUrl = "QueueStatementArray";
            const Policy = JSON.stringify({ Id: "_some_id", Version: "2012-10-17", Statement: [Statement] });
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { Policy } }));
            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));
            expect(res.Attributes!.Policy).toBe(Policy);
          });

          it("with Action Array", async () => {
            const QueueUrl = "QueueActionArray";
            const Policy = JSON.stringify({ Id: "_some_id", Version: "2012-10-17", Statement: { ...Statement, Action: [Statement.Action] } });
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { Policy } }));
            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));
            expect(res.Attributes!.Policy).toBe(Policy);
          });

          it("with Resource Array", async () => {
            const QueueUrl = "QueueResourceArray";
            const Policy = JSON.stringify({ Id: "_some_id", Version: "2012-10-17", Statement: { ...Statement, Resource: [Statement.Resource] } });
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { Policy } }));
            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));
            expect(res.Attributes!.Policy).toBe(Policy);
          });

          it("without Statement Id", async () => {
            const QueueUrl = "QueueWithoutStatementId";
            const Policy = JSON.stringify({ Id: "_some_id", Version: "2012-10-17", Statement: { ...Statement, Sid: undefined } });
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { Policy } }));
            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));
            expect(res.Attributes!.Policy).toBe(Policy);
          });
        });
      });

      describe("ReceiveMessageWaitTimeSeconds", () => {
        describe("Should fail", () => {
          it("with object", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: {} } }));
            }).rejects.toThrow("Start of structure or map found where not expected.");
          });

          it("with array", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: [] } }));
            }).rejects.toThrow("Unrecognized collection type class java.lang.String");
          });

          it("with boolean", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: true } }));
            }).rejects.toThrow("Invalid value for the parameter ReceiveMessageWaitTimeSeconds.");
          });
          it("with empty", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: "" } }));
            }).rejects.toThrow("Invalid value for the parameter ReceiveMessageWaitTimeSeconds.");
          });

          it("with empty char and number", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: " 2" } }));
            }).rejects.toThrow("Invalid value for the parameter ReceiveMessageWaitTimeSeconds.");
          });

          it("with below min allowed value", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: "-50" } }));
            }).rejects.toThrow("Invalid value for the parameter ReceiveMessageWaitTimeSeconds.");
          });

          it("with above max allowed value", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: "21" } }));
            }).rejects.toThrow("Invalid value for the parameter ReceiveMessageWaitTimeSeconds.");
          });
        });

        describe("Should pass", () => {
          it("with null", async () => {
            const QueueUrl = "NullReceiveMessageWaitTimeSeconds";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { ReceiveMessageWaitTimeSeconds: null } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["ReceiveMessageWaitTimeSeconds"] }));
            expect(res.Attributes!.ReceiveMessageWaitTimeSeconds).toBe("0");
          });

          it("with String(Number)", async () => {
            const QueueUrl = "String1024ReceiveMessageWaitTimeSeconds";
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { ReceiveMessageWaitTimeSeconds: "20" } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["ReceiveMessageWaitTimeSeconds"] }));
            expect(res.Attributes!.ReceiveMessageWaitTimeSeconds).toBe("20");
          });

          it("with number", async () => {
            const QueueUrl = "Number1024ReceiveMessageWaitTimeSeconds";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { ReceiveMessageWaitTimeSeconds: 20 } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["ReceiveMessageWaitTimeSeconds"] }));
            expect(res.Attributes!.ReceiveMessageWaitTimeSeconds).toBe("20");
          });
        });
      });

      describe("VisibilityTimeout", () => {
        describe("Should fail", () => {
          it("with object", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: {} } }));
            }).rejects.toThrow("Start of structure or map found where not expected.");
          });

          it("with array", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: [] } }));
            }).rejects.toThrow("Unrecognized collection type class java.lang.String");
          });

          it("with boolean", () => {
            expect(async () => {
              //@ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: true } }));
            }).rejects.toThrow("Invalid value for the parameter VisibilityTimeout.");
          });
          it("with empty", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: "" } }));
            }).rejects.toThrow("Invalid value for the parameter VisibilityTimeout.");
          });

          it("with empty char and number", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: " 2" } }));
            }).rejects.toThrow("Invalid value for the parameter VisibilityTimeout.");
          });

          it("with below min allowed value", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: "-50" } }));
            }).rejects.toThrow("Invalid value for the parameter VisibilityTimeout.");
          });

          it("with above max allowed value", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: "43201" } }));
            }).rejects.toThrow("Invalid value for the parameter VisibilityTimeout.");
          });
        });

        describe("Should pass", () => {
          it("with null", async () => {
            const QueueUrl = "NullReceiveVisibilityTimeout";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { VisibilityTimeout: null } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["VisibilityTimeout"] }));
            expect(res.Attributes!.VisibilityTimeout).toBe("30");
          });

          it("with String(Number)", async () => {
            const QueueUrl = "String1024VisibilityTimeout";
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { VisibilityTimeout: "20" } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["VisibilityTimeout"] }));
            expect(res.Attributes!.VisibilityTimeout).toBe("20");
          });

          it("with number", async () => {
            const QueueUrl = "Number1024VisibilityTimeout";
            // @ts-ignore
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { VisibilityTimeout: 20 } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["VisibilityTimeout"] }));
            expect(res.Attributes!.VisibilityTimeout).toBe("20");
          });
        });
      });

      describe("RedrivePolicy", () => {
        describe("Should fail", () => {
          const InvalidAttribQueueName = "InvalidAttribQueueName";

          it("with invalid JSON value", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: InvalidAttribQueueName, Attributes: { RedrivePolicy: " " } }));
            }).rejects.toThrow("Invalid value for the parameter RedrivePolicy. Reason: Redrive policy is not a valid JSON map.");
          });
          it("with invalid JSON value (number)", () => {
            expect(async () => {
              // @ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: InvalidAttribQueueName, Attributes: { RedrivePolicy: 4 } }));
            }).rejects.toThrow("Invalid value for the parameter RedrivePolicy. Reason: Redrive policy is not a valid JSON map.");
          });
          it("with invalid JSON value (array)", () => {
            expect(async () => {
              // @ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: InvalidAttribQueueName, Attributes: { RedrivePolicy: [] } }));
            }).rejects.toThrow("Invalid value for the parameter RedrivePolicy. Reason: Redrive policy is not a valid JSON map.");
          });

          it("with missing maxReceiveCount", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: InvalidAttribQueueName, Attributes: { RedrivePolicy: JSON.stringify({}) } }));
            }).rejects.toThrow("Value {} for parameter RedrivePolicy is invalid. Reason: Redrive policy does not contain mandatory attribute: maxReceiveCount.");
          });

          it("with missing deadLetterTargetArn", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: InvalidAttribQueueName, Attributes: { RedrivePolicy: JSON.stringify({ maxReceiveCount: 5 }) } }));
            }).rejects.toThrow(
              'Value {"maxReceiveCount":5} for parameter RedrivePolicy is invalid. Reason: Redrive policy does not contain mandatory attribute: deadLetterTargetArn.'
            );
          });

          it("with invalid maxReceiveCount (-)", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: InvalidAttribQueueName,
                  Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: "arn:aws:sqs:us-east-1:123456789012:MyDLQ", maxReceiveCount: -36 }) },
                })
              );
            }).rejects.toThrow(
              'Value {"deadLetterTargetArn":"arn:aws:sqs:us-east-1:123456789012:MyDLQ","maxReceiveCount":-36} for parameter RedrivePolicy is invalid. Reason: Invalid value for maxReceiveCount: -36, valid values are from 1 to 1000 both inclusive.'
            );
          });

          it("with invalid maxReceiveCount (+)", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: InvalidAttribQueueName,
                  Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: "arn:aws:sqs:us-east-1:123456789012:MyDLQ", maxReceiveCount: 4023 }) },
                })
              );
            }).rejects.toThrow(
              'Value {"deadLetterTargetArn":"arn:aws:sqs:us-east-1:123456789012:MyDLQ","maxReceiveCount":4023} for parameter RedrivePolicy is invalid. Reason: Invalid value for maxReceiveCount: 4023, valid values are from 1 to 1000 both inclusive.'
            );
          });

          it("with invalid deadLetterTargetArn", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: InvalidAttribQueueName,
                  Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: "arn:aws:sns:us-east-1:123456789012:MyTopic", maxReceiveCount: 5 }) },
                })
              );
            }).rejects.toThrow(
              'Value {"deadLetterTargetArn":"arn:aws:sns:us-east-1:123456789012:MyTopic","maxReceiveCount":5} for parameter RedrivePolicy is invalid. Reason: Only SQS queues are valid resources for deadLetterTargetArn.'
            );
          });

          it("with invalid deadLetterTargetArn Queue type", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: InvalidAttribQueueName,
                  Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: "arn:aws:sqs:us-east-1:123456789012:MyDlq.fifo", maxReceiveCount: 5 }) },
                })
              );
            }).rejects.toThrow(
              'Value {"deadLetterTargetArn":"arn:aws:sqs:us-east-1:123456789012:MyDlq.fifo","maxReceiveCount":5} for parameter RedrivePolicy is invalid. Reason: Dead-letter queue must be same type of queue as the source..'
            );
          });

          it("with inexisting deadLetterTargetArn Queue", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: InvalidAttribQueueName,
                  Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: "arn:aws:sqs:us-east-1:123456789012:MyUnknownQueue", maxReceiveCount: 5 }) },
                })
              );
            }).rejects.toThrow(
              'Value {"deadLetterTargetArn":"arn:aws:sqs:us-east-1:123456789012:MyUnknownQueue","maxReceiveCount":5} for parameter RedrivePolicy is invalid. Reason: Dead letter target does not exist.'
            );
          });

          it("with unexcpected parameters", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: "MyAwsomeDlq" }));
              await client.send(
                new CreateQueueCommand({
                  QueueName: InvalidAttribQueueName,
                  Attributes: {
                    RedrivePolicy: JSON.stringify({ deadLetterTargetArn: `arn:aws:sqs:us-east-1:123456789012:MyAwsomeDlq`, maxReceiveCount: 5, dummyField: "dummy value" }),
                  },
                })
              );
            }).rejects.toThrow(
              'Value {"deadLetterTargetArn":"arn:aws:sqs:us-east-1:123456789012:MyAwsomeDlq","maxReceiveCount":5,"dummyField":"dummy value"} for parameter RedrivePolicy is invalid. Reason: Only following attributes are supported: [maxReceiveCount, deadLetterTargetArn].'
            );
          });
        });

        it("Should pass with Standart Queue", async () => {
          await client.send(new CreateQueueCommand({ QueueName: "DummyQueue1" }));

          const RedrivePolicy = JSON.stringify({ deadLetterTargetArn: `arn:aws:sqs:us-east-1:123456789012:DummyQueue1`, maxReceiveCount: 5 });
          await client.send(
            new CreateQueueCommand({
              QueueName: "DummyQueue2",
              Attributes: { RedrivePolicy },
            })
          );

          const res = await client.send(new GetQueueAttributesCommand({ QueueUrl: "DummyQueue2", AttributeNames: ["All"] }));

          expect(res.Attributes?.RedrivePolicy).toBe(RedrivePolicy);
        });

        it("Should pass with FIFO Queue", async () => {
          await client.send(new CreateQueueCommand({ QueueName: "DummyQueue1.fifo", Attributes: { FifoQueue: "true" } }));

          const RedrivePolicy = JSON.stringify({ deadLetterTargetArn: `arn:aws:sqs:us-east-1:123456789012:DummyQueue1.fifo`, maxReceiveCount: 5 });
          await client.send(
            new CreateQueueCommand({
              QueueName: "DummyQueue2.fifo",
              Attributes: { FifoQueue: "true", RedrivePolicy },
            })
          );

          const res = await client.send(new GetQueueAttributesCommand({ QueueUrl: "DummyQueue2.fifo", AttributeNames: ["All"] }));

          expect(res.Attributes?.RedrivePolicy).toBe(RedrivePolicy);
        });
      });

      describe("RedriveAllowPolicy", () => {
        describe("Should fail", () => {
          const QueueUrl = "QueueFailRedriveAllowPolicy";
          it("with invalid type (array)", () => {
            expect(async () => {
              // @ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: [] } }));
            }).rejects.toThrow("Unrecognized collection type class java.lang.String");
          });
          it("with invalid type (object)", () => {
            expect(async () => {
              // @ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: {} } }));
            }).rejects.toThrow("Start of structure or map found where not expected");
          });

          it("with invalid type (number)", () => {
            expect(async () => {
              // @ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: 444 } }));
            }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
          });
          it("with invalid type (boolean)", () => {
            expect(async () => {
              // @ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: false } }));
            }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
          });

          it("with invalid type (string)", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: "badjson" } }));
            }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
          });

          it("with invalid JSON type (array)", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: JSON.stringify([]) } }));
            }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
          });

          it("without redrivePermission", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: JSON.stringify({}) } }));
            }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
          });

          it("with invalid redrivePermission", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "dummy" }) } }));
            }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
          });

          it("with unknown field", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "allowAll", dummy: "value" }) } })
              );
            }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
          });

          it("without sourceQueueArns", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "byQueue" }) } }));
            }).rejects.toThrow(
              `Value {"redrivePermission":"byQueue"} for parameter RedriveAllowPolicy is invalid. Reason: Amazon SQS can't create the redrive allow policy. When you specify the byQueue permission type, you must also specify one or more sourceQueueArns values.`
            );
          });

          it("with invalid sourceQueueArns (string)", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: QueueUrl,
                  Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "byQueue", sourceQueueArns: "arn:aws:sqs" }) },
                })
              );
            }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
          });

          it("without sourceQueueArns (array-anything-but-string)", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: QueueUrl,
                  Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "byQueue", sourceQueueArns: [{ dummy: "value" }] }) },
                })
              );
            }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
          });

          it("with empty sourceQueueArns", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: QueueUrl,
                  Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "byQueue", sourceQueueArns: [] }) },
                })
              );
            }).rejects.toThrow(
              `Value {"redrivePermission":"byQueue","sourceQueueArns":[]} for parameter RedriveAllowPolicy is invalid. Reason: Amazon SQS can't create the redrive allow policy. When you specify the byQueue permission type, you must also specify one or more sourceQueueArns values.`
            );
          });

          const RedriveAllowPolicy = JSON.stringify({
            redrivePermission: "byQueue",
            sourceQueueArns: [
              "arn:aws:sqs:us-east-1:123456789012:x1",
              "arn:aws:sqs:us-east-1:123456789012:x2",
              "arn:aws:sqs:us-east-1:123456789012:x3",
              "arn:aws:sqs:us-east-1:123456789012:x4",
              "arn:aws:sqs:us-east-1:123456789012:x5",
              "arn:aws:sqs:us-east-1:123456789012:x6",
              "arn:aws:sqs:us-east-1:123456789012:x7",
              "arn:aws:sqs:us-east-1:123456789012:x8",
              "arn:aws:sqs:us-east-1:123456789012:x9",
              "arn:aws:sqs:us-east-1:123456789012:x10",
              "arn:aws:sqs:us-east-1:123456789012:x11",
            ],
          });
          it("with too much sourceQueueArns", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: QueueUrl,
                  Attributes: { RedriveAllowPolicy },
                })
              );
            }).rejects.toThrow(
              `Value ${RedriveAllowPolicy} for parameter RedriveAllowPolicy is invalid. Reason: Amazon SQS can't create the redrive allow policy. The maximum number of source queue ARNs you can specify is 10.`
            );
          });

          it("with bad redrivePermission (allowAll) + sourceQueueArns couple", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: QueueUrl,
                  Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "allowAll", sourceQueueArns: ["arn:aws:sqs:us-east-1:123456789012:x7"] }) },
                })
              );
            }).rejects.toThrow(
              `Value {"redrivePermission":"allowAll","sourceQueueArns":["arn:aws:sqs:us-east-1:123456789012:x7"]} for parameter RedriveAllowPolicy is invalid. Reason: Amazon SQS can't create the redrive allow policy. To specify one or more source queue ARNs, you must set redrivePermission to byQueue.`
            );
          });

          it("with bad redrivePermission (denyAll) + sourceQueueArns couple", () => {
            expect(async () => {
              await client.send(
                new CreateQueueCommand({
                  QueueName: QueueUrl,
                  Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "denyAll", sourceQueueArns: ["arn:aws:sqs:us-east-1:123456789012:x7"] }) },
                })
              );
            }).rejects.toThrow(
              `Value {"redrivePermission":"denyAll","sourceQueueArns":["arn:aws:sqs:us-east-1:123456789012:x7"]} for parameter RedriveAllowPolicy is invalid. Reason: Amazon SQS can't create the redrive allow policy. To specify one or more source queue ARNs, you must set redrivePermission to byQueue.`
            );
          });
        });

        describe("Should pass", () => {
          it("with byQueue", async () => {
            const QueueUrl = "QueueRedriveAllowPolicyByQueue";
            const RedriveAllowPolicy = JSON.stringify({
              redrivePermission: "byQueue",
              sourceQueueArns: ["arn:aws:sqs:us-east-1:123456789012:x1", "arn:aws:sqs:us-east-1:123456789012:x2", "arn:aws:sqs:us-east-1:123456789012:x3"],
            });
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));

            expect(res.Attributes!.RedriveAllowPolicy).toBe(RedriveAllowPolicy);
          });

          it("with allowAll", async () => {
            const QueueUrl = "QueueRedriveAllowPolicyAllowAll";
            const RedriveAllowPolicy = JSON.stringify({
              redrivePermission: "allowAll",
            });
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));

            expect(res.Attributes!.RedriveAllowPolicy).toBe(RedriveAllowPolicy);
          });

          it("with denyAll", async () => {
            const QueueUrl = "QueueRedriveAllowPolicyDenyAll";
            const RedriveAllowPolicy = JSON.stringify({
              redrivePermission: "denyAll",
            });
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy } }));

            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));

            expect(res.Attributes!.RedriveAllowPolicy).toBe(RedriveAllowPolicy);
          });
        });
      });
      describe("KmsMasterKeyId", () => {
        describe("Should fail", () => {
          const QueueName = "FailQueueKmsMasterKeyId";
          it("with invalid KmsDataKeyReusePeriodSeconds", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName, Attributes: { KmsDataKeyReusePeriodSeconds: "-233" } }));
            }).rejects.toThrow("Invalid value for the parameter KmsDataKeyReusePeriodSeconds.");
          });

          it("with invalid KmsDataKeyReusePeriodSeconds", () => {
            expect(async () => {
              // @ts-expect-error
              await client.send(new CreateQueueCommand({ QueueName, Attributes: { KmsDataKeyReusePeriodSeconds: 86405 } }));
            }).rejects.toThrow("Invalid value for the parameter KmsDataKeyReusePeriodSeconds.");
          });

          it("with invalid SqsManagedSseEnabled + KmsMasterKeyId", () => {
            expect(async () => {
              await client.send(new CreateQueueCommand({ QueueName, Attributes: { SqsManagedSseEnabled: "true", KmsMasterKeyId: "alias/aws/sqs" } }));
            }).rejects.toThrow("You can use one type of server-side encryption (SSE) at one time. You can either enable KMS SSE or SQS SSE.");
          });
        });

        describe("Should pass", () => {
          it("with default KmsDataKeyReusePeriodSeconds value", async () => {
            const QueueUrl = "DefaultKmsDataKeyReusePeriodSeconds";
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { KmsMasterKeyId: "alias/aws/sqs" } }));
            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));

            expect(res.Attributes!.SqsManagedSseEnabled).toBe("false");
            expect(res.Attributes!.KmsMasterKeyId).toBe("alias/aws/sqs");
            expect(res.Attributes!.KmsDataKeyReusePeriodSeconds).toBe("300");
          });

          it("with custom KmsDataKeyReusePeriodSeconds value", async () => {
            const QueueUrl = "CustomKmsDataKeyReusePeriodSeconds";
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { KmsMasterKeyId: "alias/aws/sqs", KmsDataKeyReusePeriodSeconds: "860" } }));
            const res = await client.send(new GetQueueAttributesCommand({ QueueUrl, AttributeNames: ["All"] }));

            expect(res.Attributes!.SqsManagedSseEnabled).toBe("false");
            expect(res.Attributes!.KmsMasterKeyId).toBe("alias/aws/sqs");
            expect(res.Attributes!.KmsDataKeyReusePeriodSeconds).toBe("860");
          });
        });
      });
    });
  });

  describe("Get Queue Attributes", () => {
    const attribs = { MaximumMessageSize: "262144", VisibilityTimeout: "30" };

    it("(SDK) Should get specified attributes", async () => {
      const cmd = new GetQueueAttributesCommand({ QueueUrl: StandartQueueName, AttributeNames: ["MaximumMessageSize", "VisibilityTimeout"] });

      const res = await client.send(cmd);

      expect(res.Attributes).deep.eq(attribs);
    });

    it("(CLI) Should get specified attributes", async () => {
      const res = (await cli(`get-queue-attributes --queue-url ${StandartQueueName} --attribute-names MaximumMessageSize VisibilityTimeout`)) as string;

      expect(JSON.parse(res).Attributes).deep.eq(attribs);
    });
  });

  describe("Get Queue Url", () => {
    it("should fail to with empty queue name", () => {
      expect(async () => {
        const cmd = new GetQueueUrlCommand({ QueueName: "" });
        await client.send(cmd);
      }).rejects.toThrow("Value for parameter QueueName is invalid. Reason: Must specify a queue name.");
    });

    it("should fail to with invalid queue name", () => {
      expect(async () => {
        const cmd = new GetQueueUrlCommand({ QueueName: "InvalidName" });
        await client.send(cmd);
      }).rejects.toThrow("The specified queue does not exist.");
    });

    it("SDK", async () => {
      const cmd = new GetQueueUrlCommand({ QueueName: StandartQueueName });
      const res = await client.send(cmd);
      expect(res.QueueUrl).toBe(`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${StandartQueueName}`);
    });

    it("CLI", async () => {
      const res = JSON.parse((await cli(`get-queue-url --queue-name ${StandartQueueName}`)) as string);
      expect(res.QueueUrl).toBe(`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${StandartQueueName}`);
    });
  });

  describe("Manage Queue Tags", () => {
    it("(SDK) should tag queue", async () => {
      const cmd = new TagQueueCommand({ QueueUrl: StandartQueueName, Tags: { hello: "world", env: "prod" } });
      await client.send(cmd);
    });

    it("(CLI) should tag queue", async () => {
      await cli(`tag-queue --queue-url ${StandartQueueName} --tags cliValue=test`);
    });

    it("(SDK) should list queue tags", async () => {
      const cmd = new ListQueueTagsCommand({ QueueUrl: StandartQueueName });
      const res = await client.send(cmd);
      expect(res.Tags).deep.eq({ hello: "world", env: "prod", cliValue: "test" });
    });

    it("(CLI) should list queue tags", async () => {
      const res = JSON.parse((await cli(`list-queue-tags --queue-url ${StandartQueueName}`)) as string);
      expect(res.Tags).deep.eq({ hello: "world", env: "prod", cliValue: "test" });
    });

    it("(SDK) should untag queue", async () => {
      await client.send(new UntagQueueCommand({ QueueUrl: StandartQueueName, TagKeys: ["hello"] }));
      const cmd = new ListQueueTagsCommand({ QueueUrl: StandartQueueName });
      const res = await client.send(cmd);
      expect(res.Tags).deep.eq({ env: "prod", cliValue: "test" });
    });

    it("(CLI) should untag queue", async () => {
      await cli(`untag-queue --queue-url ${StandartQueueName} --tag-keys cliValue`);
      const cmd = new ListQueueTagsCommand({ QueueUrl: StandartQueueName });
      const res = await client.send(cmd);
      expect(res.Tags).deep.eq({ env: "prod" });
    });
  });

  describe("Purge Queue", () => {
    it("Should purge queue", async () => {
      await client.send(new PurgeQueueCommand({ QueueUrl: StandartQueueName }));
    });

    it("Should fail to purge already purged queue", () => {
      expect(async () => {
        await client.send(new PurgeQueueCommand({ QueueUrl: StandartQueueName }));
      }).rejects.toThrow(`Only one PurgeQueue operation on ${StandartQueueName} is allowed every 60 seconds.`);
    });
  });

  describe("Send Message", () => {
    describe("Standart Queue", () => {
      describe("Should fail", () => {
        it("without MessageBody", () => {
          expect(async () => {
            // @ts-expect-error
            await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName }));
          }).rejects.toThrow("The request must contain the parameter MessageBody.");
        });

        it("with empty MessageBody", () => {
          expect(async () => {
            await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "" }));
          }).rejects.toThrow("The request must contain the parameter MessageBody.");
        });

        it("with invalid MessageBody", () => {
          expect(async () => {
            // @ts-expect-error
            await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: {} }));
          }).rejects.toThrow("Start of structure or map found where not expected.");
        });

        it("with invalid DelaySeconds (NaN)", () => {
          expect(async () => {
            // @ts-expect-error
            await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", DelaySeconds: "invalid" }));
          }).rejects.toThrow("STRING_VALUE can not be converted to an Integer");
        });

        it("with invalid DelaySeconds (invalid integer range)", () => {
          expect(async () => {
            await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", DelaySeconds: -234 }));
          }).rejects.toThrow("Value -234 for parameter DelaySeconds is invalid. Reason: DelaySeconds must be >= 0 and <= 900.");

          expect(async () => {
            await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", DelaySeconds: 1000 }));
          }).rejects.toThrow("Value 1000 for parameter DelaySeconds is invalid. Reason: DelaySeconds must be >= 0 and <= 900.");
        });

        it("with invalid attributes", () => {
          expect(async () => {
            await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageGroupId: "23432" }));
          }).rejects.toThrow("The request include parameter MessageGroupId which is not valid for this queue type");

          expect(async () => {
            await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageDeduplicationId: "1000" }));
          }).rejects.toThrow("The request include parameter MessageDeduplicationId which is not valid for this queue type");
        });

        it("with invalid MessageAttributes", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageAttributes: { Hello: { DataType: "Number", StringValue: "world" } } })
            );
          }).rejects.toThrow("Can't cast the value of message (user) attribute 'Hello' to a number.");

          expect(async () => {
            await client.send(
              new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageAttributes: { Hello: { DataType: "String", StringValue: "" } } })
            );
          }).rejects.toThrow("Message (user) attribute 'Hello' must contain a non-empty value of type 'String'.");

          expect(async () => {
            await client.send(
              new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageAttributes: { "": { DataType: "String", StringValue: "some value" } } })
            );
          }).rejects.toThrow("The request must contain non-empty message (user) attribute names.");

          expect(async () => {
            // @ts-expect-error
            await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageAttributes: { Hello: {} } }));
          }).rejects.toThrow("The message (user) attribute 'Hello' must contain a non-empty message attribute value.");

          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: StandartQueueName,
                MessageBody: "Test message",
                MessageAttributes: { Hello: { DataType: "InvalidType", StringValue: "some value" } },
              })
            );
          }).rejects.toThrow("The type of message (user) attribute 'Hello' is invalid. You must use only the following supported type prefixes: Binary, Number, String.");
        });

        it("with invalid MessageAttributes", () => {
          expect(async () => {
            await client.send(
              // @ts-expect-error
              new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message", MessageSystemAttributes: { Hello: { StringValue: "World", DataType: "String" } } })
            );
          }).rejects.toThrow("Message system attribute name 'Hello' is invalid.");
        });

        it("with invalid MessageAttributes data type (String List)", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: StandartQueueName,
                MessageBody: "Test message",
                MessageAttributes: {
                  Hello: {
                    DataType: "StringList",
                    StringListValues: ["World"],
                  },
                },
              })
            );
          }).rejects.toThrow("Message attribute list values in SendMessage operation are not supported.");
        });

        it("with invalid MessageAttributes data type (Binary List)", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: StandartQueueName,
                MessageBody: "Test message",
                MessageAttributes: {
                  Hello: {
                    DataType: "BinaryList",
                    BinaryListValues: [Buffer.from("World")],
                  },
                },
              })
            );
          }).rejects.toThrow("Message attribute list values in SendMessage operation are not supported.");
        });

        it("with reserved MessageAttributes name (AWS.)", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: StandartQueueName,
                MessageBody: "Test message",
                MessageAttributes: {
                  "AWS.Hello": {
                    DataType: "String",
                    StringValue: "World",
                  },
                },
              })
            );
          }).rejects.toThrow("You can't use message attribute names beginning with 'AWS.' or 'Amazon'. These strings are reserved for internal use.");
        });

        it("with reserved MessageAttributes name (amazon.)", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: StandartQueueName,
                MessageBody: "Test message",
                MessageAttributes: {
                  "amazon.Hello": {
                    DataType: "String",
                    StringValue: "World",
                  },
                },
              })
            );
          }).rejects.toThrow("You can't use message attribute names beginning with 'AWS.' or 'Amazon'. These strings are reserved for internal use.");
        });

        it("with invalid MessageAttributes enteries length", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: StandartQueueName,
                MessageBody: "Test message",
                MessageAttributes: {
                  attrib1: { DataType: "String", StringValue: "World" },
                  attrib2: { DataType: "String", StringValue: "World" },
                  attrib3: { DataType: "String", StringValue: "World" },
                  attrib4: { DataType: "String", StringValue: "World" },
                  attrib5: { DataType: "String", StringValue: "World" },
                  attrib6: { DataType: "String", StringValue: "World" },
                  attrib7: { DataType: "String", StringValue: "World" },
                  attrib8: { DataType: "String", StringValue: "World" },
                  attrib9: { DataType: "String", StringValue: "World" },
                  attrib10: { DataType: "String", StringValue: "World" },
                  attrib11: { DataType: "String", StringValue: "World" },
                },
              })
            );
          }).rejects.toThrow("Number of message attributes [11] exceeds the allowed maximum [10].");
        });

        it("with invalid MessageAttributes entry name length", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: StandartQueueName,
                MessageBody: "Test message",
                MessageAttributes: {
                  [Array(257).fill("a").join("")]: { DataType: "String", StringValue: "World" },
                },
              })
            );
          }).rejects.toThrow("Message (user) attribute name must be shorter than 256 bytes.");
        });

        it("with invalid MessageAttributes entry type length", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: StandartQueueName,
                MessageBody: "Test message",
                MessageAttributes: {
                  attrib1: { DataType: `String.${Array(250).fill("a").join("")}`, StringValue: "World" },
                },
              })
            );
          }).rejects.toThrow("Message (user) attribute type must be shorter than 256 bytes.");
        });

        describe("with invalid Message length", () => {
          const QueueUrl = "MessageLengthDefinedQueue";
          const MaximumMessageSize = 1024;
          beforeAll(async () => {
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { MaximumMessageSize: String(MaximumMessageSize) } }));
          });

          it("MessageBody", () => {
            expect(async () => {
              await client.send(
                new SendMessageCommand({
                  QueueUrl,
                  MessageBody: Array(MaximumMessageSize + 1)
                    .fill("a")
                    .join(""),
                })
              );
            }).rejects.toThrow(`One or more parameters are invalid. Reason: Message must be shorter than ${MaximumMessageSize} bytes.`);
          });

          it("MessageAttributes", () => {
            expect(async () => {
              await client.send(
                new SendMessageCommand({
                  QueueUrl,
                  MessageBody: "Hello",
                  MessageAttributes: {
                    attrib1: {
                      DataType: "String",
                      StringValue: Array(MaximumMessageSize + 1)
                        .fill("a")
                        .join(""),
                    },
                  },
                })
              );
            }).rejects.toThrow(`One or more parameters are invalid. Reason: Message must be shorter than ${MaximumMessageSize} bytes.`);
          });

          it("MessageBody + MessageAttributes", () => {
            expect(async () => {
              await client.send(
                new SendMessageCommand({
                  QueueUrl,
                  MessageBody: Array(513).fill("a").join(""),
                  MessageAttributes: {
                    attrib1: {
                      DataType: "String",
                      StringValue: Array(256).fill("a").join(""),
                    },
                    attrib2: {
                      DataType: "String",
                      StringValue: Array(256).fill("a").join(""),
                    },
                  },
                })
              );
            }).rejects.toThrow(`One or more parameters are invalid. Reason: Message must be shorter than ${MaximumMessageSize} bytes.`);
          });
        });
      });

      it("should send message with custom data type", async () => {
        const res = await client.send(
          new SendMessageCommand({
            QueueUrl: StandartQueueName,
            MessageBody: "Test Message",
            MessageAttributes: { UserId: { DataType: "Number.bigint", StringValue: "1234567890123456789012" } },
            MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "some-trace-id" } },
          })
        );

        expect(res.MD5OfMessageAttributes).toBe("797ab158d73dcb5242dedc4412c8e855");
        expect(res.MD5OfMessageBody).toBe("d1d4180b7e411c4be86b00fb2ee103eb");
        expect(res.MD5OfMessageSystemAttributes).toBe("fdce4f2818803f2f73becc09a54792c0");
        expect(typeof res.MessageId).toBe("string");
        expect(res.MessageId!.length).toBeGreaterThan(10);
      });

      it("should send with castable type", async () => {
        const QueueUrl = "CastableQueue";

        await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));

        try {
          await client.send(
            // @ts-ignore
            new SendMessageCommand({
              QueueUrl,
              MessageBody: 0,
              MessageAttributes: { attrib1: { DataType: "String", StringValue: 2345 }, attrib2: { DataType: "String", StringValue: true } },
            })
          );
        } catch (error) {}

        const res = await client.send(new ReceiveMessageCommand({ QueueUrl, MaxNumberOfMessages: 10, MessageAttributeNames: ["All"] }));

        const [msg] = res.Messages!;

        expect(msg.Body).toBe("0");
        expect(msg.MD5OfBody).toBe("cfcd208495d565ef66e7dff9f98764da");
        expect(msg.MD5OfMessageAttributes).toBe("c92eae09ef2c14cd949cc265ebc9cb50");
        expect(msg.MessageAttributes).deep.eq({
          attrib1: { DataType: "String", StringValue: "2345" },
          attrib2: { DataType: "String", StringValue: "true" },
        });
      });

      it("(SDK) should send message", async () => {
        const res = await client.send(
          new SendMessageCommand({
            QueueUrl: StandartQueueName,
            MessageBody: "Test Message",

            MessageAttributes: { Hello: { DataType: "String", StringValue: "World" } },
            MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "some-trace-id" } },
          })
        );

        expect(res.MD5OfMessageAttributes).toBe("7db7fb1ba7f41366a8ea5eb18220b26d");
        expect(res.MD5OfMessageBody).toBe("d1d4180b7e411c4be86b00fb2ee103eb");
        expect(res.MD5OfMessageSystemAttributes).toBe("fdce4f2818803f2f73becc09a54792c0");
        expect(typeof res.MessageId).toBe("string");
        expect(res.MessageId!.length).toBeGreaterThan(10);
      });

      it("(CLI) should send message", async () => {
        const res = JSON.parse(
          (await cli(
            `send-message --queue-url ${StandartQueueName} --message-body "Test Message" --message-attributes '{ "Hello":{ "DataType":"String","StringValue":"World" } }' --message-system-attributes '{ "AWSTraceHeader":{ "DataType":"String","StringValue":"some-trace-id" } }'`
          )) as string
        );

        expect(res.MD5OfMessageAttributes).toBe("7db7fb1ba7f41366a8ea5eb18220b26d");
        expect(res.MD5OfMessageBody).toBe("d1d4180b7e411c4be86b00fb2ee103eb");
        expect(res.MD5OfMessageSystemAttributes).toBe("fdce4f2818803f2f73becc09a54792c0");
        expect(typeof res.MessageId).toBe("string");
        expect(res.MessageId!.length).toBeGreaterThan(10);
      });

      it(
        "should pass with SQS expected DelaySeconds behaviour",
        async () => {
          const QueueUrl = "DelayedTestQueue";

          await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { DelaySeconds: "2" } }));
          await client.send(new SendMessageCommand({ QueueUrl, MessageBody: "Hello world" }));

          const { Messages: NoneMessages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
          expect(NoneMessages).toBeUndefined();

          await sleep(3);

          const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
          expect(Messages).toHaveLength(1);

          await client.send(new DeleteMessageCommand({ QueueUrl, ReceiptHandle: Messages![0].ReceiptHandle }));
          const { Messages: NoneMessages2 } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
          expect(NoneMessages2).toBeUndefined();

          const MessageBody = "Hello world from delayed queue";
          await client.send(new SendMessageCommand({ QueueUrl, MessageBody, DelaySeconds: 5 }));

          await sleep(3);
          const { Messages: NoneMessages3 } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
          expect(NoneMessages3).toBeUndefined();

          await sleep(3); // 3 + 3 exceeds DelaySeconds: 5

          const { Messages: Messages2 } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
          expect(Messages2).toHaveLength(1);

          expect(Messages2![0].Body).toBe(MessageBody);
        },
        { timeout: 20 * 1000 }
      );
    });

    describe("FIFO Queue", () => {
      describe("Should fail", () => {
        it("without MessageDeduplicationId", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: FifoQueueName,
                MessageBody: "Test message",
                MessageGroupId: randomUUID(),
              })
            );
          }).rejects.toThrow("The queue should either have ContentBasedDeduplication enabled or MessageDeduplicationId provided explicitly");
        });

        it("without MessageGroupId", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: FifoQueueName,
                MessageBody: "Test message",
                MessageDeduplicationId: randomUUID(),
              })
            );
          }).rejects.toThrow("The request must contain the parameter MessageGroupId.");
        });

        it("with invalid DelaySeconds (NaN)", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({
                QueueUrl: FifoQueueName,
                MessageBody: "Test message",
                MessageDeduplicationId: randomUUID(),
                MessageGroupId: randomUUID(),
                // @ts-expect-error
                DelaySeconds: "invalid",
              })
            );
          }).rejects.toThrow("STRING_VALUE can not be converted to an Integer");
        });

        it("with invalid FIFO Queue attribtue DelaySeconds", () => {
          expect(async () => {
            await client.send(
              new SendMessageCommand({ QueueUrl: FifoQueueName, MessageBody: "Test message", MessageDeduplicationId: randomUUID(), MessageGroupId: randomUUID(), DelaySeconds: 60 })
            );
          }).rejects.toThrow("Value 60 for parameter DelaySeconds is invalid. Reason: The request include parameter that is not valid for this queue type.");
        });
      });
      it("should send message", async () => {
        const res = await client.send(
          new SendMessageCommand({ QueueUrl: FifoQueueName, MessageBody: "Test message", MessageDeduplicationId: randomUUID(), MessageGroupId: randomUUID() })
        );

        expect(res.MD5OfMessageBody).toBe("82dfa5549ebc9afc168eb7931ebece5f");
        expect(typeof res.MessageId).toBe("string");
        expect(res.MessageId!.length).toBeGreaterThan(10);
        expect(typeof res.SequenceNumber).toBe("string");
        expect(res.SequenceNumber!.length).toBe(20);
      });

      it("should deduplicate message", async () => {
        const MessageDeduplicationId = randomUUID();
        const MessageGroupId = randomUUID();
        const res1 = await client.send(new SendMessageCommand({ QueueUrl: FifoQueueName, MessageBody: "Test message 1", MessageDeduplicationId, MessageGroupId }));
        const res2 = await client.send(new SendMessageCommand({ QueueUrl: FifoQueueName, MessageBody: "another message", MessageDeduplicationId, MessageGroupId }));

        expect(typeof res1.MessageId).toBe("string");
        expect(res1.MessageId!.length).toBeGreaterThan(10);
        expect(res1.MessageId).toBe(res2.MessageId);

        expect(typeof res1.SequenceNumber).toBe("string");
        expect(res1.SequenceNumber!.length).toBe(20);
        expect(res1.SequenceNumber).toBe(res2.SequenceNumber);

        expect(res1.MD5OfMessageBody).toBe("b607df2baaced02c7a7f5c3dc6973301");
        expect(res2.MD5OfMessageBody).toBe("80d402c39512ac39d7e8e79e2cfa935e");
      });
    });
  });

  describe("Receive Message", () => {
    describe("Should fail", () => {
      it("with invalid MaxNumberOfMessages", () => {
        expect(async () => {
          await client.send(
            new ReceiveMessageCommand({
              QueueUrl: StandartQueueName,
              MaxNumberOfMessages: 50,
            })
          );
        }).rejects.toThrow("Value 50 for parameter MaxNumberOfMessages is invalid. Reason: Must be between 1 and 10, if provided.");
      });

      it("with invalid WaitTimeSeconds", () => {
        expect(async () => {
          await client.send(
            new ReceiveMessageCommand({
              QueueUrl: StandartQueueName,
              WaitTimeSeconds: 50,
            })
          );
        }).rejects.toThrow("Value 50 for parameter WaitTimeSeconds is invalid. Reason: Must be >= 0 and <= 20, if provided.");
      });

      it("with invalid VisibilityTimeout", () => {
        expect(async () => {
          await client.send(
            new ReceiveMessageCommand({
              QueueUrl: StandartQueueName,
              VisibilityTimeout: 43201,
            })
          );
        }).rejects.toThrow("Value 43201 for parameter VisibilityTimeout is invalid. Reason: Must be >= 0 and <= 43200, if provided.");
      });
    });

    describe("Should pass", () => {
      it("with All Attributes", async () => {
        const QueueUrl = "AllAttribsQueue";

        await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));

        await client.send(
          new SendMessageCommand({
            QueueUrl: QueueUrl,
            MessageBody: "message from SDK",
            MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "dummy-id" } },
            MessageAttributes: { DummyName: { DataType: "String", StringValue: "dummy value" } },
          })
        );

        const { Messages } = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: QueueUrl,
            AttributeNames: ["All"],
            MessageAttributeNames: ["All"],
          })
        );

        const [msg] = Messages!;

        expect(msg.Body).toBe("message from SDK");
        expect(msg.MD5OfBody).toBe("6d05602485318fa52030abb234e75682");
        expect(msg.MessageAttributes).deep.eq({ DummyName: { DataType: "String", StringValue: "dummy value" } });
        expect(msg.MD5OfMessageAttributes).toBe("ceb4493d294c7939e5ef8d20ee169e02");
        expect(typeof msg.ReceiptHandle).toBe("string");

        expect(msg.Attributes).toBeDefined();
        expect(isNaN(msg.Attributes!.ApproximateReceiveCount as unknown as number)).toBe(false);
        expect(isNaN(msg.Attributes!.SentTimestamp as unknown as number)).toBe(false);
        expect(isNaN(msg.Attributes!.ApproximateFirstReceiveTimestamp as unknown as number)).toBe(false);
      });

      it("(SDK) with filtered Message Attributes", async () => {
        const QueueUrl = "SDKFilterAttribQueue";

        await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
        await client.send(
          new SendMessageCommand({
            QueueUrl,
            MessageBody: "message from SDK",
            MessageAttributes: {
              Dummy1Name: { DataType: "String", StringValue: "dummy 1 value" },
              Dummy2Name: { DataType: "String", StringValue: "dummy 2 value" },
              OtherName: { DataType: "String", StringValue: "other value" },
              Dummy3Name: { DataType: "Binary", BinaryValue: Buffer.from("dummy 2 value") },
            },
          })
        );

        const { Messages } = await client.send(
          new ReceiveMessageCommand({
            QueueUrl,
            MessageAttributeNames: ["Dummy.*"],
          })
        );

        const [msg] = Messages!;

        expect(msg.Body).toBe("message from SDK");
        expect(msg.MD5OfBody).toBe("6d05602485318fa52030abb234e75682");
        expect(msg.MessageAttributes).deep.eq({
          Dummy1Name: { DataType: "String", StringValue: "dummy 1 value" },
          Dummy2Name: { DataType: "String", StringValue: "dummy 2 value" },
          Dummy3Name: { DataType: "Binary", BinaryValue: Buffer.from("dummy 2 value") },
        });
        expect(msg.MD5OfMessageAttributes).toBe("c5c0d2c6f195fcbc91083c5465d8955f");
        expect(typeof msg.ReceiptHandle).toBe("string");
      });

      it("(CLI) with filtered Message Attributes", async () => {
        const QueueUrl = "CLIFilterAttribQueue";

        await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
        await client.send(
          new SendMessageCommand({
            QueueUrl,
            MessageBody: "message from CLI",
            MessageAttributes: {
              Dummy1Name: { DataType: "String", StringValue: "dummy 1 value" },
              Dummy2Name: { DataType: "String", StringValue: "dummy 2 value" },
              OtherName: { DataType: "String", StringValue: "other value" },
            },
          })
        );

        const { Messages } = JSON.parse((await cli(`receive-message --queue-url ${QueueUrl} --message-attribute-names Dummy.*`)) as string);
        const [msg] = Messages!;

        expect(msg.Body).toBe("message from CLI");
        expect(msg.MD5OfBody).toBe("72db3782a7482d9cf0dc847798cf0f3a");
        expect(msg.MessageAttributes).deep.eq({
          Dummy1Name: { DataType: "String", StringValue: "dummy 1 value" },
          Dummy2Name: { DataType: "String", StringValue: "dummy 2 value" },
        });
        expect(msg.MD5OfMessageAttributes).toBe("00954f005e854e11dbe82998292c6666");
        expect(typeof msg.ReceiptHandle).toBe("string");
      });

      it(
        "with SQS WaitTimeSeconds behaviour",
        async () => {
          const QueueUrl = "WaitTimeSecondsQueue";
          const MessageBody = "Message sent later";
          const WaitTimeSeconds = 5;

          await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));

          setTimeout(async () => {
            await client.send(new SendMessageCommand({ QueueUrl, MessageBody }));
          }, 3 * 1000);

          const { Messages: NoneMessages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
          expect(NoneMessages).toBeUndefined();

          const { Messages: NoneMessages2 } = await client.send(new ReceiveMessageCommand({ QueueUrl, WaitTimeSeconds: 1 }));
          expect(NoneMessages2).toBeUndefined();

          const beforeReq = Date.now() / 1000;
          const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl, WaitTimeSeconds, MaxNumberOfMessages: 2 }));
          const afterReq = Date.now() / 1000;

          const spentTime = afterReq - beforeReq;
          expect(spentTime).toBeGreaterThan(WaitTimeSeconds);

          expect(Messages).toHaveLength(1);
          expect(Messages![0].Body).toBe(MessageBody);
        },
        { timeout: 10 * 1000 }
      );

      it(
        "with SQS WaitTimeSeconds + VisibilityTimeout behaviour",
        async () => {
          const QueueUrl = "WaitTimeSecondsVisibilityTimeoutQueue";
          const MessageBody = "Message with 0 Visibility";

          await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
          await client.send(new SendMessageCommand({ QueueUrl, MessageBody }));

          const { Messages } = await client.send(
            // @ts-ignore
            new ReceiveMessageCommand({ QueueUrl, WaitTimeSeconds: 0, VisibilityTimeout: 0, MaxNumberOfMessages: 10, AttributeNames: ["ApproximateReceiveCount"] })
          );
        },
        { timeout: 10 * 1000 }
      );
    });
  });

  describe("Delete Message", () => {
    it("should delete with valid ReceiptHandle", async () => {
      await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Test message" }));

      const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName }));

      const res = await client.send(new DeleteMessageCommand({ QueueUrl: StandartQueueName, ReceiptHandle: Messages![0].ReceiptHandle }));

      expect(res.$metadata.httpStatusCode).toBe(200);

      const res2 = await client.send(new DeleteMessageCommand({ QueueUrl: StandartQueueName, ReceiptHandle: Messages![0].ReceiptHandle }));

      expect(res2.$metadata.httpStatusCode).toBe(200);
    });

    it("Should fail to delete with invalid ReceiptHandle", () => {
      expect(async () => {
        await client.send(new DeleteMessageCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "invalid-receipt-id" }));
      }).rejects.toThrow('The input receipt handle "invalid-receipt-id" is not valid.');
    });

    describe("[FIFO]", () => {
      const QueueUrl = "FIFODeleteMessageQueue789.fifo";
      beforeAll(async () => {
        await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { FifoQueue: "true", ContentBasedDeduplication: "true" } }));
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl,
            Entries: [
              { Id: "1", MessageBody: "Hello", MessageGroupId: "gid-1" },
              { Id: "2", MessageBody: "Hello 2", MessageGroupId: "gid-2" },
              { Id: "3", MessageBody: "Hello 3", MessageGroupId: "gid-3" },
            ],
          })
        );
      });

      it("[FIFO] should fail to delete visible message", async () => {
        const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl, VisibilityTimeout: 0 }));
        const [msg] = Messages!;
        expect(async () => {
          await client.send(new DeleteMessageCommand({ QueueUrl, ReceiptHandle: msg.ReceiptHandle }));
        }).rejects.toThrow(`Value ${msg.ReceiptHandle} for parameter ReceiptHandle is invalid. Reason: The receipt handle has expired.`);
      });
    });
  });

  describe("Delete Message Batch", () => {
    describe("Should fail", () => {
      it("without Entries", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new DeleteMessageBatchCommand({ QueueUrl: StandartQueueName }));
        }).rejects.toThrow("The request must contain the parameter Entries.");
      });

      it("with empty Entries", () => {
        expect(async () => {
          await client.send(new DeleteMessageBatchCommand({ QueueUrl: StandartQueueName, Entries: [] }));
        }).rejects.toThrow("There should be at least one DeleteMessageBatchRequestEntry in the request.");
      });

      it("with too much entries", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new DeleteMessageBatchCommand({ QueueUrl: StandartQueueName, Entries: [7, 8, 9, 10, 11, 1, 2, 3, 4, 5, 6] }));
        }).rejects.toThrow("Maximum number of entries per request are 10. You have sent 11.");
      });

      it("without Entry id", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new DeleteMessageBatchCommand({ QueueUrl: StandartQueueName, Entries: [{ Id: "id-1", ReceiptHandle: "dummy" }, { ReceiptHandle: "dummy2" }] }));
        }).rejects.toThrow("The request must contain the parameter DeleteMessageBatchRequestEntry.2.Id.");
      });

      it("with empty Entry id", () => {
        expect(async () => {
          await client.send(
            new DeleteMessageBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                { Id: "id-1", ReceiptHandle: "dummy" },
                { Id: " ", ReceiptHandle: "dummy2" },
              ],
            })
          );
        }).rejects.toThrow("A batch entry id can only contain alphanumeric characters, hyphens and underscores. It can be at most 80 letters long.");
      });

      it("with duplicated Entry ids", () => {
        const Id = "id-1";
        expect(async () => {
          await client.send(
            new DeleteMessageBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                { Id, ReceiptHandle: "dummy" },
                { Id, ReceiptHandle: "dummy2" },
              ],
            })
          );
        }).rejects.toThrow(`Id ${Id} repeated.`);
      });

      it("without ReceiptHandle", async () => {
        const res = await client.send(
          new DeleteMessageBatchCommand({
            QueueUrl: StandartQueueName,
            // @ts-expect-error
            Entries: [{ Id: "id-1" }],
          })
        );

        expect(res.Successful).toBeUndefined();
        expect(res.Failed).toHaveLength(1);
        expect(res.Failed![0]).deep.eq({
          Code: "MissingParameter",
          Id: "id-1",
          Message: "The request must contain the parameter ReceiptHandle.",
          SenderFault: true,
        });
      });

      it("with empty ReceiptHandle", async () => {
        const res = await client.send(
          new DeleteMessageBatchCommand({
            QueueUrl: StandartQueueName,

            Entries: [{ Id: "id-1", ReceiptHandle: " " }],
          })
        );

        expect(res.Successful).toBeUndefined();
        expect(res.Failed).toHaveLength(1);
        expect(res.Failed![0]).deep.eq({
          Code: "MissingParameter",
          Id: "id-1",
          Message: "The request must contain the parameter ReceiptHandle.",
          SenderFault: true,
        });
      });

      it("with invalid ReceiptHandle", async () => {
        const res = await client.send(
          new DeleteMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [{ Id: "id-1", ReceiptHandle: "dummy2" }],
          })
        );

        expect(res.Successful).toBeUndefined();
        expect(res.Failed).toHaveLength(1);
        expect(res.Failed![0]).deep.eq({
          Code: "ReceiptHandleIsInvalid",
          Id: "id-1",
          Message: 'The input receipt handle "dummy2" is not valid.',
          SenderFault: true,
        });
      });
    });

    describe("Should pass", () => {
      it("with all Entries", async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", MessageBody: "message 1" },
              { Id: "id-2", MessageBody: "message 2" },
              { Id: "id-3", MessageBody: "message 3" },
            ],
          })
        );

        const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName, MaxNumberOfMessages: 10 }));

        const res = await client.send(
          new DeleteMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle },
              { Id: "id-2", ReceiptHandle: Messages![1].ReceiptHandle },
              { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle },
            ],
          })
        );

        expect(res.Failed).toBeUndefined();
        expect(res.Successful).deep.eq([{ Id: "id-1" }, { Id: "id-2" }, { Id: "id-3" }]);
      });

      it("(SDK) with partial failure", async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", MessageBody: "message 1" },
              { Id: "id-2", MessageBody: "message 2" },
              { Id: "id-3", MessageBody: "message 3" },
            ],
          })
        );

        const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName, MaxNumberOfMessages: 10 }));

        const res = await client.send(
          new DeleteMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle },
              { Id: "id-2", ReceiptHandle: "dummy-receiptHandle" },
              { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle },
            ],
          })
        );

        expect(res.Failed).deep.eq([
          {
            Code: "ReceiptHandleIsInvalid",
            Id: "id-2",
            Message: 'The input receipt handle "dummy-receiptHandle" is not valid.',
            SenderFault: true,
          },
        ]);
        expect(res.Successful).deep.eq([{ Id: "id-1" }, { Id: "id-3" }]);
      });

      it("(CLI) with partial failure", async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", MessageBody: "message 1" },
              { Id: "id-2", MessageBody: "message 2" },
              { Id: "id-3", MessageBody: "message 3" },
            ],
          })
        );

        const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName, MaxNumberOfMessages: 10 }));

        const Entries = [
          { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle },
          { Id: "id-2", ReceiptHandle: "dummy-receiptHandle" },
          { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle },
        ];
        const res = JSON.parse((await cli(`delete-message-batch --queue-url ${StandartQueueName} --entries '${JSON.stringify(Entries)}'`)) as string);

        expect(res.Failed).deep.eq([
          {
            Code: "ReceiptHandleIsInvalid",
            Id: "id-2",
            Message: 'The input receipt handle "dummy-receiptHandle" is not valid.',
            SenderFault: true,
          },
        ]);
        expect(res.Successful).deep.eq([{ Id: "id-1" }, { Id: "id-3" }]);
      });
    });
  });

  describe("Delete Queue", () => {
    it("should delete queue", async () => {
      const QueueName = "DeleteableQueue";
      await client.send(new CreateQueueCommand({ QueueName }));

      const res = await client.send(new DeleteQueueCommand({ QueueUrl: QueueName }));

      expect(res.$metadata.httpStatusCode).toBe(200);
    });

    it("should fail to create a queue with in progress deleted queue", async () => {
      const QueueName = "DeleteableQueue2";
      await client.send(new CreateQueueCommand({ QueueName }));

      const res = await client.send(new DeleteQueueCommand({ QueueUrl: QueueName }));
      expect(res.$metadata.httpStatusCode).toBe(200);

      expect(async () => {
        await client.send(new CreateQueueCommand({ QueueName }));
      }).rejects.toThrow("You must wait 60 seconds after deleting a queue before you can create another with the same name.");
    });
  });

  describe("Send Message Batch", () => {
    describe("Should fail", () => {
      it("without Entries", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new SendMessageBatchCommand({ QueueUrl: StandartQueueName }));
        }).rejects.toThrow("The request must contain the parameter Entries.");
      });
      it("with empty entries", () => {
        expect(async () => {
          await client.send(new SendMessageBatchCommand({ QueueUrl: StandartQueueName, Entries: [] }));
        }).rejects.toThrow("There should be at least one SendMessageBatchRequestEntry in the request.");
      });

      it("with too much entries", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new SendMessageBatchCommand({ QueueUrl: StandartQueueName, Entries: [7, 8, 9, 10, 11, 1, 2, 3, 4, 5, 6] }));
        }).rejects.toThrow("Maximum number of entries per request are 10. You have sent 11.");
      });

      it("without entry id", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                {
                  Id: "1",
                  MessageBody: "Hello WORLD",
                },
                // @ts-expect-error
                {
                  MessageBody: "Hello WORLD 2",
                },
                {
                  Id: "3",
                  MessageBody: "Hello WORLD 3",
                },
              ],
            })
          );
        }).rejects.toThrow("The request must contain the parameter SendMessageBatchRequestEntry.2.Id.");
      });

      it("with invalid entry id", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                {
                  Id: "é",
                  MessageBody: "Hello WORLD",
                },
              ],
            })
          );
        }).rejects.toThrow("A batch entry id can only contain alphanumeric characters, hyphens and underscores. It can be at most 80 letters long.");
      });

      it("with duplicated entry ids", () => {
        const Id = "some-id";
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                {
                  Id,
                  MessageBody: "Hello WORLD 1",
                },
                {
                  Id,
                  MessageBody: "Hello WORLD 2",
                },
              ],
            })
          );
        }).rejects.toThrow(`Id ${Id} repeated.`);
      });

      it("[Standart Queue] without MessageBody", async () => {
        const res = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              // @ts-expect-error
              {
                Id: "1",
              },
            ],
          })
        );

        expect(res.Failed).deep.eq([
          {
            Code: "MissingParameter",
            Id: "1",
            Message: "The request must contain the parameter SendMessageBatchRequestEntry.1.MessageBody.",
            SenderFault: true,
          },
        ]);
      });

      it("[Standart Queue] with empty MessageBody", async () => {
        const res = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "",
              },
            ],
          })
        );

        expect(res.Failed).deep.eq([
          {
            Code: "MissingParameter",
            Id: "1",
            Message: "The request must contain the parameter SendMessageBatchRequestEntry.1.MessageBody.",
            SenderFault: true,
          },
        ]);
      });

      it("[Standart Queue] with invalid MessageBody", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                {
                  Id: "1",
                  // @ts-expect-error
                  MessageBody: {},
                },
              ],
            })
          );
        }).rejects.toThrow("Start of structure or map found where not expected.");
      });

      it("[Standart Queue] with invalid DelaySeconds (object)", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                {
                  Id: "1",
                  MessageBody: "some message",
                  // @ts-expect-error
                  DelaySeconds: {},
                },
              ],
            })
          );
        }).rejects.toThrow("Start of structure or map found where not expected.");
      });

      it("[Standart Queue] with invalid DelaySeconds (object)", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                {
                  Id: "1",
                  MessageBody: "some message",
                  // @ts-expect-error
                  DelaySeconds: [],
                },
              ],
            })
          );
        }).rejects.toThrow("Start of list found where not expected");
      });

      it("[Standart Queue] with invalid DelaySeconds (object)", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                {
                  Id: "1",
                  MessageBody: "some message",
                  // @ts-expect-error
                  DelaySeconds: {},
                },
              ],
            })
          );
        }).rejects.toThrow("Start of structure or map found where not expected.");
      });

      it("[Standart Queue] with invalid MessageAttributes - StringValue (object)", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                {
                  Id: "1",
                  MessageBody: "some message",
                  MessageAttributes: {
                    attrib1: {
                      DataType: "Number",
                      // @ts-expect-error
                      StringValue: {},
                    },
                  },
                },
              ],
            })
          );
        }).rejects.toThrow("Start of structure or map found where not expected.");
      });

      it("[Standart Queue] with MessageDeduplicationId", async () => {
        const res = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
                MessageDeduplicationId: "id-1",
              },
            ],
          })
        );

        expect(res.Failed).deep.eq([
          {
            Code: "InvalidParameterValue",
            Id: "1",
            Message: "The request include parameter that is not valid for this queue type",
            SenderFault: true,
          },
        ]);
      });

      it("[Standart Queue] with MessageGroupId", async () => {
        const res = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
                MessageGroupId: "id-1",
              },
            ],
          })
        );

        expect(res.Failed).deep.eq([
          {
            Code: "InvalidParameterValue",
            Id: "1",
            Message: "The request include parameter that is not valid for this queue type",
            SenderFault: true,
          },
        ]);
      });

      it("[FIFO Queue] without MessageBody", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: FifoQueueName,
              Entries: [
                // @ts-expect-error
                {
                  Id: "1",
                },
              ],
            })
          );
        }).rejects.toThrow("The request must contain the parameter SendMessageBatchRequestEntry.1.MessageBody.");
      });

      it("[FIFO Queue] with empty MessageBody", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: FifoQueueName,
              Entries: [
                {
                  Id: "1",
                  MessageBody: "",
                },
              ],
            })
          );
        }).rejects.toThrow("The request must contain the parameter SendMessageBatchRequestEntry.1.MessageBody.");
      });

      it("[FIFO Queue] without MessageGroupId", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: FifoQueueName,
              Entries: [
                {
                  Id: "1",
                  MessageBody: "some message",
                },
              ],
            })
          );
        }).rejects.toThrow("The request must contain the parameter MessageGroupId.");
      });

      it("[FIFO Queue] without MessageDeduplicationId", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: FifoQueueName,
              Entries: [
                {
                  Id: "1",
                  MessageBody: "some message",
                  MessageGroupId: "id-1",
                },
              ],
            })
          );
        }).rejects.toThrow("The queue should either have ContentBasedDeduplication enabled or MessageDeduplicationId provided explicitly");
      });

      it("[FIFO Queue] with DelaySeconds", () => {
        expect(async () => {
          await client.send(
            new SendMessageBatchCommand({
              QueueUrl: FifoQueueName,
              Entries: [
                {
                  Id: "1",
                  MessageBody: "some message",
                  MessageGroupId: "id-1",
                  MessageDeduplicationId: "id-1",
                  DelaySeconds: 3,
                },
              ],
            })
          );
        }).rejects.toThrow("Value 3 for parameter DelaySeconds is invalid. Reason: The request include parameter that is not valid for this queue type.");
      });

      describe("with invalid Message length", () => {
        const QueueUrl = "MessageBatchLengthDefinedQueue";
        const FifoQueueUrl = "FifoMessageBatchLengthDefinedQueue.fifo";
        const MaximumMessageSize = 1024;
        beforeAll(async () => {
          await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { MaximumMessageSize: String(MaximumMessageSize) } }));
          await client.send(
            new CreateQueueCommand({
              QueueName: FifoQueueUrl,
              Attributes: { FifoQueue: "true", ContentBasedDeduplication: "true", MaximumMessageSize: String(MaximumMessageSize) },
            })
          );
        });

        it("[Standart Queue] total length", () => {
          expect(async () => {
            await client.send(
              new SendMessageBatchCommand({
                QueueUrl,
                Entries: [
                  {
                    Id: "1",
                    MessageBody: Array(131072).fill("a").join(""),
                  },
                  {
                    Id: "2",
                    MessageBody: Array(131000).fill("b").join(""),
                  },
                  {
                    Id: "3",
                    MessageBody: "message3",
                    MessageAttributes: {
                      Yolo: {
                        DataType: "Number.customtype",
                        StringValue: "12345678901234567890",
                      },
                    },
                  },
                  {
                    Id: "4",
                    MessageBody: "message4",
                    MessageAttributes: {
                      Yolo: {
                        DataType: "String",
                        StringValue: Array(50).fill("c").join(""),
                      },
                    },
                  },
                ],
              })
            );
          }).rejects.toThrow("Batch requests cannot be longer than 262144 bytes. You have sent 262189 bytes.");
        });
        it("[FIFO Queue] total length", () => {
          expect(async () => {
            await client.send(
              new SendMessageBatchCommand({
                QueueUrl: FifoQueueUrl,
                Entries: [
                  {
                    Id: "1",
                    MessageGroupId: "1",
                    MessageBody: Array(131072).fill("a").join(""),
                  },
                  {
                    Id: "2",
                    MessageGroupId: "2",
                    MessageBody: Array(131000).fill("b").join(""),
                  },
                  {
                    Id: "3",
                    MessageGroupId: "3",
                    MessageBody: "message3",
                    MessageAttributes: {
                      Yolo: {
                        DataType: "Number.customtype",
                        StringValue: "12345678901234567890",
                      },
                    },
                  },
                  {
                    Id: "4",
                    MessageGroupId: "4",
                    MessageBody: "message4",
                    MessageAttributes: {
                      Yolo: {
                        DataType: "String",
                        StringValue: Array(50).fill("c").join(""),
                      },
                    },
                  },
                ],
              })
            );
          }).rejects.toThrow("Batch requests cannot be longer than 262144 bytes. You have sent 262189 bytes.");
        });

        it("[Standart Queue] individual message length", async () => {
          const res = await client.send(
            new SendMessageBatchCommand({
              QueueUrl,
              Entries: [
                {
                  Id: "1",
                  MessageBody: Array(MaximumMessageSize).fill("a").join(""),
                },
                {
                  Id: "2",
                  MessageBody: Array(MaximumMessageSize - 100)
                    .fill("a")
                    .join(""),
                  MessageAttributes: {
                    attrib1: {
                      DataType: "String",
                      StringValue: Array(50).fill("b").join(""),
                    },
                    attrib2: {
                      DataType: "Number",
                      StringValue: "12345678901234568",
                    },
                    attrib3: {
                      DataType: "Binary",
                      BinaryValue: Buffer.from(Array(30).fill("c").join("")),
                    },
                  },
                },
              ],
            })
          );

          expect(res.Successful).toHaveLength(1);
          expect(res.Successful![0].Id).toBe("1");

          expect(res.Failed).toHaveLength(1);
          expect(res.Failed![0].Id).toBe("2");
        });

        it("[FIFO Queue] individual message length", async () => {
          expect(async () => {
            await client.send(
              new SendMessageBatchCommand({
                QueueUrl: FifoQueueUrl,
                Entries: [
                  {
                    Id: "1",
                    MessageGroupId: "1",
                    MessageBody: Array(MaximumMessageSize).fill("a").join(""),
                  },
                  {
                    Id: "2",
                    MessageGroupId: "2",
                    MessageBody: Array(MaximumMessageSize - 100)
                      .fill("a")
                      .join(""),
                    MessageAttributes: {
                      attrib1: {
                        DataType: "String",
                        StringValue: Array(50).fill("b").join(""),
                      },
                      attrib2: {
                        DataType: "Number",
                        StringValue: "12345678901234568",
                      },
                      attrib3: {
                        DataType: "Binary",
                        BinaryValue: Buffer.from(Array(30).fill("c").join("")),
                      },
                    },
                  },
                ],
              })
            );
          }).rejects.toThrow("One or more parameters are invalid. Reason: Message must be shorter than 1024 bytes.");
        });
      });
    });

    describe("Should pass", () => {
      it("[Standart Queue] without Attributes", async () => {
        const res = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
              },
              {
                Id: "2",
                MessageBody: "some message 2",
              },
            ],
          })
        );

        expect(res.Failed).toBeUndefined();
        expect(res.Successful!.length).toBe(2);

        const [msg1, msg2] = res.Successful!;

        expect(msg1.Id).toBe("1");
        expect(typeof msg1.MessageId).toBe("string");
        expect(msg1.MD5OfMessageBody).toBe("df49b60423903e095b80d9b4a92eb065");

        expect(msg2.Id).toBe("2");
        expect(typeof msg2.MessageId).toBe("string");
        expect(msg2.MD5OfMessageBody).toBe("36e8a424130490596fc507dba99d2ace");
      });

      it("[Standart Queue] with Attributes", async () => {
        const res = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
                MessageAttributes: {
                  data1: {
                    DataType: "Number",
                    StringValue: "1",
                  },
                  data2: {
                    DataType: "Number",
                    StringValue: "2",
                  },
                },
              },
              {
                Id: "2",
                MessageBody: "some message 2",
                MessageAttributes: {
                  data1: {
                    DataType: "Number",
                    StringValue: "1",
                  },
                },
                MessageSystemAttributes: {
                  AWSTraceHeader: {
                    DataType: "String",
                    StringValue: "some-value",
                  },
                },
              },
            ],
          })
        );

        expect(res.Failed).toBeUndefined();
        expect(res.Successful!.length).toBe(2);

        const [msg1, msg2] = res.Successful!;

        expect(msg1.Id).toBe("1");
        expect(typeof msg1.MessageId).toBe("string");
        expect(msg1.MD5OfMessageBody).toBe("df49b60423903e095b80d9b4a92eb065");
        expect(msg1.MD5OfMessageAttributes).toBe("b53b5acf24e7fd9567705bd8027b1c76");
        expect(msg1.MD5OfMessageSystemAttributes).toBeUndefined();
        expect(msg1.SequenceNumber).toBeUndefined();

        expect(msg2.Id).toBe("2");
        expect(typeof msg2.MessageId).toBe("string");
        expect(msg2.MD5OfMessageBody).toBe("36e8a424130490596fc507dba99d2ace");
        expect(msg2.MD5OfMessageAttributes).toBe("cc7f712733e0ad2cc9f1fefbd28bab9c");
        expect(msg2.MD5OfMessageSystemAttributes).toBe("a3263a0cbc09023ccd431feb61438309");
        expect(msg2.SequenceNumber).toBeUndefined();
      });

      it("[FIFO Queue] with Attributes", async () => {
        const res = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: FifoQueueName,
            Entries: [
              {
                Id: "1",
                MessageBody: "some message",
                MessageGroupId: "group-1",
                MessageDeduplicationId: "id-1",
                MessageAttributes: {
                  data1: {
                    DataType: "Number",
                    StringValue: "1",
                  },
                  data2: {
                    DataType: "Number",
                    StringValue: "2",
                  },
                },
              },
              {
                Id: "2",
                MessageBody: "some message 2",
                MessageDeduplicationId: "id-2",
                MessageGroupId: "group-1",
                MessageAttributes: {
                  data1: {
                    DataType: "Number",
                    StringValue: "1",
                  },
                },
                MessageSystemAttributes: {
                  AWSTraceHeader: {
                    DataType: "String",
                    StringValue: "some-value",
                  },
                },
              },
            ],
          })
        );

        expect(res.Failed).toBeUndefined();
        expect(res.Successful!.length).toBe(2);

        const [msg1, msg2] = res.Successful!;

        expect(msg1.Id).toBe("1");
        expect(typeof msg1.MessageId).toBe("string");
        expect(msg1.MD5OfMessageBody).toBe("df49b60423903e095b80d9b4a92eb065");
        expect(msg1.MD5OfMessageAttributes).toBe("b53b5acf24e7fd9567705bd8027b1c76");
        expect(msg1.MD5OfMessageSystemAttributes).toBeUndefined();
        expect(typeof msg1.SequenceNumber).toBe("string");
        expect(msg1.SequenceNumber).toHaveLength(20);

        expect(msg2.Id).toBe("2");
        expect(typeof msg2.MessageId).toBe("string");
        expect(msg2.MD5OfMessageBody).toBe("36e8a424130490596fc507dba99d2ace");
        expect(msg2.MD5OfMessageAttributes).toBe("cc7f712733e0ad2cc9f1fefbd28bab9c");
        expect(msg2.MD5OfMessageSystemAttributes).toBe("a3263a0cbc09023ccd431feb61438309");
        expect(typeof msg2.SequenceNumber).toBe("string");
        expect(msg2.SequenceNumber).toHaveLength(20);
      });

      it("(CLI) [FIFO Queue] with Attributes", async () => {
        const Entries = [
          {
            Id: "1",
            MessageBody: "some message",
            MessageGroupId: "group-1",
            MessageDeduplicationId: "id-1",
            MessageAttributes: {
              data1: {
                DataType: "Number",
                StringValue: "1",
              },
              data2: {
                DataType: "Number",
                StringValue: "2",
              },
            },
          },
          {
            Id: "2",
            MessageBody: "some message 2",
            MessageDeduplicationId: "id-2",
            MessageGroupId: "group-1",
            MessageAttributes: {
              data1: {
                DataType: "Number",
                StringValue: "1",
              },
            },
            MessageSystemAttributes: {
              AWSTraceHeader: {
                DataType: "String",
                StringValue: "some-value",
              },
            },
          },
        ];

        const res = JSON.parse((await cli(`send-message-batch --queue-url ${FifoQueueName} --entries '${JSON.stringify(Entries)}'`)) as string);

        expect(res.Failed).toBeUndefined();
        expect(res.Successful!.length).toBe(2);

        const [msg1, msg2] = res.Successful!;

        expect(msg1.Id).toBe("1");
        expect(typeof msg1.MessageId).toBe("string");
        expect(msg1.MD5OfMessageBody).toBe("df49b60423903e095b80d9b4a92eb065");
        expect(msg1.MD5OfMessageAttributes).toBe("b53b5acf24e7fd9567705bd8027b1c76");
        expect(msg1.MD5OfMessageSystemAttributes).toBeUndefined();
        expect(typeof msg1.SequenceNumber).toBe("string");
        expect(msg1.SequenceNumber).toHaveLength(20);

        expect(msg2.Id).toBe("2");
        expect(typeof msg2.MessageId).toBe("string");
        expect(msg2.MD5OfMessageBody).toBe("36e8a424130490596fc507dba99d2ace");
        expect(msg2.MD5OfMessageAttributes).toBe("cc7f712733e0ad2cc9f1fefbd28bab9c");
        expect(msg2.MD5OfMessageSystemAttributes).toBe("a3263a0cbc09023ccd431feb61438309");
        expect(typeof msg2.SequenceNumber).toBe("string");
        expect(msg2.SequenceNumber).toHaveLength(20);
      });

      it("[Standart Queue] with castable types", async () => {
        const QueueUrl = "BatchCastableQueue";

        await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));

        try {
          await client.send(
            // @ts-ignore
            new SendMessageBatchCommand({
              QueueUrl,
              Entries: [
                {
                  Id: "1",
                  MessageBody: false,
                  MessageAttributes: {
                    attrib1: {
                      DataType: "String",
                      StringValue: 0,
                    },
                    attrib2: {
                      DataType: "String",
                      StringValue: false,
                    },
                  },
                },
              ],
            })
          );
        } catch (error) {}

        const res = await client.send(new ReceiveMessageCommand({ QueueUrl, MaxNumberOfMessages: 10, MessageAttributeNames: ["All"] }));

        const [msg] = res.Messages!;

        expect(msg.Body).toBe("false");
        expect(msg.MD5OfBody).toBe("68934a3e9455fa72420237eb05902327");
        expect(msg.MD5OfMessageAttributes).toBe("2739524b68e7d718aeaf6730e2e38cfe");
        expect(msg.MessageAttributes).deep.eq({
          attrib1: { DataType: "String", StringValue: "0" },
          attrib2: { DataType: "String", StringValue: "false" },
        });
      });
      it("[FIFO Queue] with castable types", async () => {
        const QueueUrl = "FifoBatchCastableQueue.fifo";

        await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { FifoQueue: "true", ContentBasedDeduplication: "true" } }));

        try {
          await client.send(
            // @ts-ignore
            new SendMessageBatchCommand({
              QueueUrl,
              Entries: [
                {
                  Id: 5,
                  MessageGroupId: 7654,
                  MessageBody: false,
                  MessageAttributes: {
                    attrib1: {
                      DataType: "String",
                      StringValue: 0,
                    },
                    attrib2: {
                      DataType: "String",
                      StringValue: false,
                    },
                  },
                },
              ],
            })
          );
        } catch (error) {}

        const res = await client.send(new ReceiveMessageCommand({ QueueUrl, MaxNumberOfMessages: 10, MessageAttributeNames: ["All"], AttributeNames: ["All"] }));

        const [msg] = res.Messages!;

        expect(msg.Body).toBe("false");
        expect(msg.MD5OfBody).toBe("68934a3e9455fa72420237eb05902327");
        expect(msg.MD5OfMessageAttributes).toBe("2739524b68e7d718aeaf6730e2e38cfe");
        expect(msg.MessageAttributes).deep.eq({
          attrib1: { DataType: "String", StringValue: "0" },
          attrib2: { DataType: "String", StringValue: "false" },
        });
        expect(typeof msg.Attributes!.MessageGroupId).toBe("string");
        expect(msg.Attributes!.MessageGroupId).toBe("7654");
      });
    });
  });

  describe("Change Message Visibility", () => {
    describe("Should fail", () => {
      it("without ReceiptHandle", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, VisibilityTimeout: 34 }));
        }).rejects.toThrow("The request must contain the parameter ReceiptHandle.");
      });

      it("with empty ReceiptHandle", () => {
        expect(async () => {
          await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "", VisibilityTimeout: 34 }));
        }).rejects.toThrow("The request must contain the parameter ReceiptHandle.");
      });

      it("with invalid ReceiptHandle", () => {
        const ReceiptHandle = "45234sdsqdZER/qsqd";
        expect(async () => {
          await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle, VisibilityTimeout: 34 }));
        }).rejects.toThrow(`The input receipt handle "${ReceiptHandle}" is not valid.`);
      });

      it("without VisibilityTimeout", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id" }));
        }).rejects.toThrow("The request must contain the parameter VisibilityTimeout.");
      });

      it("with invalid VisibilityTimeout (object)", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id", VisibilityTimeout: {} }));
        }).rejects.toThrow(`Start of structure or map found where not expected.`);
      });

      it("with invalid VisibilityTimeout (array)", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id", VisibilityTimeout: [] }));
        }).rejects.toThrow(`Start of list found where not expected`);
      });

      it("with invalid VisibilityTimeout (NaN)", () => {
        const VisibilityTimeout = "dummy-value";
        expect(async () => {
          // @ts-expect-error
          await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id", VisibilityTimeout }));
        }).rejects.toThrow(`Value ${VisibilityTimeout} for parameter VisibilityTimeout is invalid. Reason: Must be between 0 and 43200.`);
      });

      it("with invalid VisibilityTimeout (-)", () => {
        const VisibilityTimeout = -10;
        expect(async () => {
          await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id", VisibilityTimeout }));
        }).rejects.toThrow(`Value ${VisibilityTimeout} for parameter VisibilityTimeout is invalid. Reason: Must be between 0 and 43200.`);
      });
      it("with invalid VisibilityTimeout (+)", () => {
        const VisibilityTimeout = 43201;
        expect(async () => {
          await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: "dummy id", VisibilityTimeout }));
        }).rejects.toThrow(`Value ${VisibilityTimeout} for parameter VisibilityTimeout is invalid. Reason: Must be between 0 and 43200.`);
      });
    });

    it("Should pass", async () => {
      await client.send(new SendMessageCommand({ QueueUrl: StandartQueueName, MessageBody: "Hello" }));
      const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName }));

      const res = await client.send(new ChangeMessageVisibilityCommand({ QueueUrl: StandartQueueName, ReceiptHandle: Messages![0].ReceiptHandle, VisibilityTimeout: 34 }));

      expect(res.$metadata.httpStatusCode).toBe(200);
    });

    it(
      "Should pass with SQS VisibilityTimeout expected behaviour",
      async () => {
        const QueueUrl = "VisibilityTestQueue";

        await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { VisibilityTimeout: "3" } }));
        await client.send(new SendMessageCommand({ QueueUrl, MessageBody: "Hello world" }));

        const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));

        expect(Messages).toHaveLength(1);

        const { Messages: NoneMessages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
        expect(NoneMessages).toBeUndefined();

        await sleep(3);

        const { Messages: backedMessages } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
        expect(backedMessages).toHaveLength(1);

        const [msg] = backedMessages!;

        await client.send(new ChangeMessageVisibilityCommand({ QueueUrl, ReceiptHandle: msg.ReceiptHandle, VisibilityTimeout: 10 }));
        await sleep(5);

        const { Messages: NoneMessages2 } = await client.send(new ReceiveMessageCommand({ QueueUrl }));
        expect(NoneMessages2).toBeUndefined();
      },
      { timeout: 10 * 1000 }
    );
  });

  describe("Change Message Visibility Batch", () => {
    describe("Should fail", () => {
      it("without Entries", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new ChangeMessageVisibilityBatchCommand({ QueueUrl: StandartQueueName }));
        }).rejects.toThrow("The request must contain the parameter Entries.");
      });
      it("with empty entries", () => {
        expect(async () => {
          await client.send(new ChangeMessageVisibilityBatchCommand({ QueueUrl: StandartQueueName, Entries: [] }));
        }).rejects.toThrow("There should be at least one ChangeMessageVisibilityBatch in the request.");
      });

      it("with too much entries", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new ChangeMessageVisibilityBatchCommand({ QueueUrl: StandartQueueName, Entries: [7, 8, 9, 10, 11, 1, 2, 3, 4, 5, 6] }));
        }).rejects.toThrow("Maximum number of entries per request are 10. You have sent 11.");
      });

      it("without entry id", () => {
        expect(async () => {
          await client.send(
            // @ts-expect-error
            new ChangeMessageVisibilityBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                {
                  Id: "1",
                },

                {
                  ReceiptHandle: "dummy",
                },
                {
                  Id: "3",
                },
              ],
            })
          );
        }).rejects.toThrow("The request must contain the parameter ChangeMessageVisibilityBatch.2.Id.");
      });

      it("with invalid entry id", () => {
        expect(async () => {
          await client.send(
            new ChangeMessageVisibilityBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                // @ts-expect-error
                {
                  Id: "é",
                },
              ],
            })
          );
        }).rejects.toThrow("A batch entry id can only contain alphanumeric characters, hyphens and underscores. It can be at most 80 letters long.");
      });

      it("with duplicated entry ids", () => {
        const Id = "some-id";
        expect(async () => {
          await client.send(
            new ChangeMessageVisibilityBatchCommand({
              QueueUrl: StandartQueueName,
              Entries: [
                {
                  Id,
                  ReceiptHandle: "Hello WORLD 1",
                },
                {
                  Id,
                  ReceiptHandle: "Hello WORLD 2",
                },
              ],
            })
          );
        }).rejects.toThrow(`Id ${Id} repeated.`);
      });

      it("without ReceiptHandle", async () => {
        const res = await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            // @ts-expect-error
            Entries: [{ Id: "id-1", VisibilityTimeout: 20 }],
          })
        );

        expect(res.Successful).toBeUndefined();
        expect(res.Failed).toHaveLength(1);
        expect(res.Failed![0]).deep.eq({
          Code: "MissingParameter",
          Id: "id-1",
          Message: "The request must contain the parameter ReceiptHandle.",
          SenderFault: true,
        });
      });

      it("with empty ReceiptHandle", async () => {
        const res = await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,

            Entries: [{ Id: "id-1", ReceiptHandle: " ", VisibilityTimeout: 20 }],
          })
        );

        expect(res.Successful).toBeUndefined();
        expect(res.Failed).toHaveLength(1);
        expect(res.Failed![0]).deep.eq({
          Code: "MissingParameter",
          Id: "id-1",
          Message: "The request must contain the parameter ReceiptHandle.",
          SenderFault: true,
        });
      });

      it("with invalid ReceiptHandle", async () => {
        const res = await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [{ Id: "id-1", ReceiptHandle: "dummy2", VisibilityTimeout: 20 }],
          })
        );

        expect(res.Successful).toBeUndefined();
        expect(res.Failed).toHaveLength(1);
        expect(res.Failed![0]).deep.eq({
          Code: "ReceiptHandleIsInvalid",
          Id: "id-1",
          Message: 'The input receipt handle "dummy2" is not valid.',
          SenderFault: true,
        });
      });

      it("without VisibilityTimeout", async () => {
        const res = await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,

            Entries: [{ Id: "id-1", ReceiptHandle: "dummy" }],
          })
        );

        expect(res.Successful).toBeUndefined();
        expect(res.Failed).toHaveLength(1);
        expect(res.Failed![0]).deep.eq({
          Code: "MissingParameter",
          Id: "id-1",
          Message: "The request must contain the parameter ChangeMessageVisibilityBatchRequestEntry.1.VisibilityTimeout.",
          SenderFault: true,
        });
      });

      it("with invalid VisibilityTimeout", async () => {
        const res = await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [{ Id: "id-1", ReceiptHandle: "dummy2", VisibilityTimeout: -85 }],
          })
        );

        expect(res.Successful).toBeUndefined();
        expect(res.Failed).toHaveLength(1);
        expect(res.Failed![0]).deep.eq({
          Code: "InvalidParameterValue",
          Id: "id-1",
          Message: "Value -85 for parameter VisibilityTimeout is invalid. Reason: VisibilityTimeout must be an integer between 0 and 43200.",
          SenderFault: true,
        });
      });

      it("with Id as array", () => {
        expect(async () => {
          await client.send(
            new ChangeMessageVisibilityBatchCommand({
              QueueUrl: StandartQueueName,
              // @ts-expect-error
              Entries: [{ Id: [], ReceiptHandle: "dummy2", VisibilityTimeout: 5 }],
            })
          );
        }).rejects.toThrow("Start of list found where not expected");
      });
      it("with Id as object", () => {
        expect(async () => {
          await client.send(
            new ChangeMessageVisibilityBatchCommand({
              QueueUrl: StandartQueueName,
              // @ts-expect-error
              Entries: [{ Id: {}, ReceiptHandle: "dummy2", VisibilityTimeout: 5 }],
            })
          );
        }).rejects.toThrow("Start of structure or map found where not expected");
      });

      it("with VisibilityTimeout as array", () => {
        expect(async () => {
          await client.send(
            new ChangeMessageVisibilityBatchCommand({
              QueueUrl: StandartQueueName,
              // @ts-expect-error
              Entries: [{ Id: "id-1", ReceiptHandle: "dummy2", VisibilityTimeout: [] }],
            })
          );
        }).rejects.toThrow("Start of list found where not expected");
      });
      it("with VisibilityTimeout as object", () => {
        expect(async () => {
          await client.send(
            new ChangeMessageVisibilityBatchCommand({
              QueueUrl: StandartQueueName,
              // @ts-expect-error
              Entries: [{ Id: "id-1", ReceiptHandle: "dummy2", VisibilityTimeout: {} }],
            })
          );
        }).rejects.toThrow("Start of structure or map found where not expected");
      });

      it("with ReceiptHandle as array", () => {
        expect(async () => {
          await client.send(
            new ChangeMessageVisibilityBatchCommand({
              QueueUrl: StandartQueueName,
              // @ts-expect-error
              Entries: [{ Id: "id-1", ReceiptHandle: [], VisibilityTimeout: 8 }],
            })
          );
        }).rejects.toThrow("Start of list found where not expected");
      });
      it("with ReceiptHandle as object", () => {
        expect(async () => {
          await client.send(
            new ChangeMessageVisibilityBatchCommand({
              QueueUrl: StandartQueueName,
              // @ts-expect-error
              Entries: [{ Id: "id-1", ReceiptHandle: {}, VisibilityTimeout: 5 }],
            })
          );
        }).rejects.toThrow("Start of structure or map found where not expected");
      });
    });

    describe("Should pass", () => {
      it("with all Entries", async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", MessageBody: "message 1" },
              { Id: "id-2", MessageBody: "message 2" },
              { Id: "id-3", MessageBody: "message 3" },
            ],
          })
        );

        const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName, MaxNumberOfMessages: 10 }));

        const res = await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle, VisibilityTimeout: 20 },
              { Id: "id-2", ReceiptHandle: Messages![1].ReceiptHandle, VisibilityTimeout: 20 },
              { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle, VisibilityTimeout: 20 },
            ],
          })
        );

        expect(res.Failed).toBeUndefined();
        expect(res.Successful).deep.eq([{ Id: "id-1" }, { Id: "id-2" }, { Id: "id-3" }]);
      });

      it("(SDK) with partial failure", async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", MessageBody: "message 1" },
              { Id: "id-2", MessageBody: "message 2" },
              { Id: "id-3", MessageBody: "message 3" },
            ],
          })
        );

        const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName, MaxNumberOfMessages: 10 }));

        const res = await client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle, VisibilityTimeout: 20 },
              { Id: "id-2", ReceiptHandle: "dummy", VisibilityTimeout: 20 },
              { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle, VisibilityTimeout: -20 },
            ],
          })
        );

        expect(res.Failed).deep.eq([
          {
            Code: "ReceiptHandleIsInvalid",
            Id: "id-2",
            Message: 'The input receipt handle "dummy" is not valid.',
            SenderFault: true,
          },
          {
            Code: "InvalidParameterValue",
            Id: "id-3",
            Message: "Value -20 for parameter VisibilityTimeout is invalid. Reason: VisibilityTimeout must be an integer between 0 and 43200.",
            SenderFault: true,
          },
        ]);
        expect(res.Successful).deep.eq([{ Id: "id-1" }]);
      });

      it("(CLI) with partial failure", async () => {
        await client.send(
          new SendMessageBatchCommand({
            QueueUrl: StandartQueueName,
            Entries: [
              { Id: "id-1", MessageBody: "message 1" },
              { Id: "id-2", MessageBody: "message 2" },
              { Id: "id-3", MessageBody: "message 3" },
            ],
          })
        );

        const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: StandartQueueName, MaxNumberOfMessages: 10 }));

        const Entries = [
          { Id: "id-1", ReceiptHandle: Messages![0].ReceiptHandle, VisibilityTimeout: 20 },
          { Id: "id-2", ReceiptHandle: "dummy", VisibilityTimeout: 20 },
          { Id: "id-3", ReceiptHandle: Messages![2].ReceiptHandle, VisibilityTimeout: -20 },
        ];

        const res = JSON.parse((await cli(`change-message-visibility-batch --queue-url ${StandartQueueName} --entries '${JSON.stringify(Entries)}'`)) as string);

        expect(res.Failed).deep.eq([
          {
            Code: "ReceiptHandleIsInvalid",
            Id: "id-2",
            Message: 'The input receipt handle "dummy" is not valid.',
            SenderFault: true,
          },
          {
            Code: "InvalidParameterValue",
            Id: "id-3",
            Message: "Value -20 for parameter VisibilityTimeout is invalid. Reason: VisibilityTimeout must be an integer between 0 and 43200.",
            SenderFault: true,
          },
        ]);
        expect(res.Successful).deep.eq([{ Id: "id-1" }]);
      });
    });
  });

  describe("Add Permission", () => {
    describe("Should fail", () => {
      const QueueUrl = "FailAddPermissionsQueue";

      beforeAll(async () => {
        await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
      });

      it("without Actions", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new AddPermissionCommand({ QueueUrl, AWSAccountIds: ["123456789012"], Label: "Permission1" }));
        }).rejects.toThrow("The request must contain the parameter ActionName.");
      });

      it("with empty Actions", () => {
        expect(async () => {
          await client.send(new AddPermissionCommand({ QueueUrl, Actions: [], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
        }).rejects.toThrow("The request must contain the parameter ActionName.");
      });

      it("with invalid Actions", () => {
        expect(async () => {
          await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessageBatch"], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
        }).rejects.toThrow("Value SQS:SendMessageBatch for parameter ActionName is invalid. Reason: Please refer to the appropriate WSDL for a list of valid actions.");
      });

      it("with forbidden Actions", () => {
        expect(async () => {
          await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["CreateQueue"], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
        }).rejects.toThrow("Value SQS:CreateQueue for parameter ActionName is invalid. Reason: Only the queue owner is allowed to invoke this action.");
      });

      it("without AWSAccountIds", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], Label: "Permission1" }));
        }).rejects.toThrow("The request must contain the parameter AWSAccountIds.");
      });

      it("with empty AWSAccountIds", () => {
        expect(async () => {
          await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], AWSAccountIds: [], Label: "Permission1" }));
        }).rejects.toThrow("The request must contain the parameter AWSAccountIds.");
      });

      it("without Label", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], AWSAccountIds: ["123456789012"] }));
        }).rejects.toThrow("The request must contain the parameter Label.");
      });

      it("without empty Label", () => {
        expect(async () => {
          await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], AWSAccountIds: ["123456789012"], Label: "" }));
        }).rejects.toThrow("The request must contain the parameter Label.");
      });

      it("with same Label and different Statement", () => {
        expect(async () => {
          await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["SendMessage"], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
          await client.send(new AddPermissionCommand({ QueueUrl, Actions: ["DeleteMessage"], AWSAccountIds: ["123456789012"], Label: "Permission1" }));
        }).rejects.toThrow("Value Permission1 for parameter Label is invalid. Reason: Already exists.");
      });

      it("with over statement limit", () => {
        expect(async () => {
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

  describe("Remove Permission", () => {
    const QueueUrl = "RemovePermissionsQueue";

    beforeAll(async () => {
      await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
    });

    it("should fail without Label", () => {
      expect(async () => {
        // @ts-expect-error
        await client.send(new RemovePermissionCommand({ QueueUrl }));
      }).rejects.toThrow("The request must contain the parameter Label.");
    });

    it("should fail with empty Label", () => {
      expect(async () => {
        await client.send(new RemovePermissionCommand({ QueueUrl, Label: "" }));
      }).rejects.toThrow("The request must contain the parameter Label.");
    });

    it("should fail with inexisting Statement", () => {
      expect(async () => {
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

  describe("List Dead Letter Source Queues", () => {
    const QueueName = "ListDLSQueue";

    const RedrivePolicy = JSON.stringify({ deadLetterTargetArn: `arn:aws:sqs:us-east-1:123456789012:${QueueName}`, maxReceiveCount: 5 });
    beforeAll(async () => {
      await client.send(new CreateQueueCommand({ QueueName }));
      await client.send(
        new CreateQueueCommand({
          QueueName: "SourceQueue1",
          Attributes: { RedrivePolicy },
        })
      );

      await client.send(
        new CreateQueueCommand({
          QueueName: "SourceQueue2",
          Attributes: { RedrivePolicy },
        })
      );
      await client.send(
        new CreateQueueCommand({
          QueueName: "SourceQueue3",
          Attributes: { RedrivePolicy },
        })
      );
    });

    describe("Should fail", () => {
      it("with invalid MaxResults integer range", () => {
        expect(async () => {
          await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: -23 }));
        }).rejects.toThrow("Value for parameter MaxResults is invalid. Reason: MaxResults must be an integer between 1 and 1000.");

        expect(async () => {
          await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: 1020 }));
        }).rejects.toThrow("Value for parameter MaxResults is invalid. Reason: MaxResults must be an integer between 1 and 1000.");
      });

      it("with invalid NextToken", () => {
        expect(async () => {
          await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, NextToken: "invalidtoken" }));
        }).rejects.toThrow("Invalid or expired next token.");
      });
    });

    describe("Should pass", () => {
      it("by listing all queueUrls", async () => {
        const res = await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName }));

        expect(res.NextToken).toBeUndefined();
        expect(res.queueUrls).deep.eq([
          "http://localhost:55323/123456789012/SourceQueue1",
          "http://localhost:55323/123456789012/SourceQueue2",
          "http://localhost:55323/123456789012/SourceQueue3",
        ]);
      });

      it("with MaxResults 0", async () => {
        const res = await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: 0 }));

        expect(res.NextToken).toBeUndefined();
        expect(res.queueUrls).deep.eq([
          "http://localhost:55323/123456789012/SourceQueue1",
          "http://localhost:55323/123456789012/SourceQueue2",
          "http://localhost:55323/123456789012/SourceQueue3",
        ]);
      });

      it("with one by requests pagination", async () => {
        const res1 = await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: 1 }));
        expect(res1.queueUrls).deep.eq(["http://localhost:55323/123456789012/SourceQueue1"]);
        expect(typeof res1.NextToken).toBe("string");

        const res2 = await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: 1, NextToken: res1.NextToken }));
        expect(res2.queueUrls).deep.eq(["http://localhost:55323/123456789012/SourceQueue2"]);
        expect(typeof res2.NextToken).toBe("string");

        const res3 = await client.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: QueueName, MaxResults: 1, NextToken: res2.NextToken }));
        expect(res3.queueUrls).deep.eq(["http://localhost:55323/123456789012/SourceQueue3"]);
        expect(res3.NextToken).toBeUndefined();
      });

      it("with CLI", async () => {
        const res = JSON.parse((await cli(`list-dead-letter-source-queues --queue-url ${QueueName} --max-results 1`)) as string);
        expect(res.queueUrls).deep.eq(["http://localhost:55323/123456789012/SourceQueue1"]);
        expect(typeof res.NextToken).toBe("string");
      });
    });
  });

  describe.skip("Should List Queues", () => {
    it("Should list created queues", async () => {
      const res = await client.send(new ListQueuesCommand());

      expect(res.$metadata.httpStatusCode).toBe(200);
      expect(res.QueueUrls).deep.eq([
        `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${StandartQueueName}`,
        `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${FifoQueueName}`,
        `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/MyAwsomeDlq`,
        `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue1`,
        `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue2`,
        `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue1.fifo`,
        `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue2.fifo`,
      ]);
    });

    it("(SDK) Should list created queues with prefix and limit", async () => {
      const res = await client.send(new ListQueuesCommand({ QueueNamePrefix: "M", MaxResults: 1 }));

      expect(res.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${StandartQueueName}`]);

      const res2 = await client.send(new ListQueuesCommand({ QueueNamePrefix: "M", MaxResults: 1, NextToken: res.NextToken }));

      expect(res2.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/${FifoQueueName}`]);

      const res3 = await client.send(new ListQueuesCommand({ QueueNamePrefix: "M", MaxResults: 10, NextToken: res2.NextToken }));

      expect(res3.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/MyAwsomeDlq`]);

      expect(res3.NextToken).toBeUndefined();
    });

    it("(CLI) Should list created queues with prefix and limit", async () => {
      const res = JSON.parse((await cli(`list-queues --queue-name-prefix D --max-items 1`)) as string);

      expect(res.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue1`]);

      const res2 = JSON.parse((await cli(`list-queues --queue-name-prefix D --max-items 2 --starting-token "${res.NextToken}"`)) as string);

      expect(res2.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue2`, `http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue1.fifo`]);

      const res3 = JSON.parse((await cli(`list-queues --queue-name-prefix D --max-items 10 --starting-token "${res2.NextToken}"`)) as string);
      expect(res3.QueueUrls).deep.eq([`http://localhost:${PORT}/${AWS_ACCOUNT_ID}/DummyQueue2.fifo`]);
      expect(res3.NextToken).toBeUndefined();
    });
  });

  describe("SetQueueAttributes", () => {
    describe("Standart Queue", () => {
      const RedriveAllowPolicy = JSON.stringify({ redrivePermission: "allowAll" });
      describe("Should fail", () => {
        const QueueUrl = "FailQueueSetQueueAttributes";
        beforeAll(async () => {
          await client.send(new CreateQueueCommand({ QueueName: QueueUrl }));
        });

        it("without Attributes", () => {
          expect(async () => {
            // @ts-expect-error
            await client.send(new SetQueueAttributesCommand({ QueueUrl }));
          }).rejects.toThrow("The request must contain the parameter Attribute.Name.");
        });

        it("with invalid Attributes type", () => {
          expect(async () => {
            // @ts-expect-error
            await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: [] }));
          }).rejects.toThrow("The request must contain the parameter Attribute.Name.");
        });
        it("with empty Attributes", () => {
          expect(async () => {
            await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: {} }));
          }).rejects.toThrow("The request must contain the parameter Attribute.Name.");
        });

        it("with invalid Attribute name", () => {
          expect(async () => {
            await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { FifoQueue: "true" } }));
          }).rejects.toThrow("Unknown Attribute FifoQueue.");
        });

        it("with invalid Attribute type (object)", () => {
          expect(async () => {
            // @ts-expect-error
            await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { DelaySeconds: {} } }));
          }).rejects.toThrow("Start of structure or map found where not expected.");
        });

        it("with invalid Attribute type (object)", () => {
          expect(async () => {
            // @ts-expect-error
            await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { DelaySeconds: [] } }));
          }).rejects.toThrow("Start of list found where not expected");
        });

        it("with invalid queue Attribute (FifoThroughputLimit)", () => {
          expect(async () => {
            await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { FifoThroughputLimit: "perQueue" } }));
          }).rejects.toThrow("You can specify the FifoThroughputLimit only when FifoQueue is set to true.");
        });

        it("with invalid queue Attribute (DeduplicationScope)", () => {
          expect(async () => {
            await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { DeduplicationScope: "messageGroup" } }));
          }).rejects.toThrow("You can specify the DeduplicationScope only when FifoQueue is set to true.");
        });

        it("with invalid queue Attribute (SqsManagedSseEnabled + KmsMasterKeyId)", () => {
          expect(async () => {
            await client.send(new SetQueueAttributesCommand({ QueueUrl, Attributes: { SqsManagedSseEnabled: "true", KmsMasterKeyId: "alias/aws/sqs" } }));
          }).rejects.toThrow("You can use one type of server-side encryption (SSE) at one time. You can either enable KMS SSE or SQS SSE.");
        });

        it("with invalid Policy Statement length", () => {
          expect(async () => {
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

        it("Should fail", () => {
          expect(async () => {
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

        it("with invalid FifoThroughputLimit", () => {
          expect(async () => {
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

  describe("DLQ", () => {
    const SourceQueue = "MoveMessage_SourceQueue";
    const DLQ = "MoveMessage_DLQ";
    beforeAll(async () => {
      await client.send(new CreateQueueCommand({ QueueName: DLQ }));

      const RedrivePolicy = JSON.stringify({ deadLetterTargetArn: `arn:aws:sqs:us-east-1:1234567890:${DLQ}`, maxReceiveCount: 3 });
      await client.send(new CreateQueueCommand({ QueueName: SourceQueue, Attributes: { RedrivePolicy, VisibilityTimeout: "1" } }));
    });

    it("Should move messages to DLQ after x receive", async () => {
      const AWSTraceHeader = "trace-id=1234";
      const MessageAttributes = { attrib1: { DataType: "String", StringValue: "dummy value" } };
      const MessageBody = "Hello World";

      const { MessageId, MD5OfMessageAttributes, MD5OfMessageBody } = await client.send(
        new SendMessageCommand({
          QueueUrl: SourceQueue,
          MessageBody,
          MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: AWSTraceHeader } },
          MessageAttributes,
        })
      );
      await client.send(new ReceiveMessageCommand({ QueueUrl: SourceQueue }));
      await sleep(1);
      await client.send(new ReceiveMessageCommand({ QueueUrl: SourceQueue }));
      await sleep(1);
      await client.send(new ReceiveMessageCommand({ QueueUrl: SourceQueue }));

      await sleep(1);

      const { Messages: SourceQueueMsg } = await client.send(new ReceiveMessageCommand({ QueueUrl: SourceQueue }));

      expect(SourceQueueMsg).toBeUndefined();

      const { Messages } = await client.send(new ReceiveMessageCommand({ QueueUrl: DLQ, AttributeNames: ["All"], MessageAttributeNames: ["All"] }));

      expect(Messages).toHaveLength(1);

      const [msg] = Messages!;

      expect(msg.MessageId).toBe(MessageId);
      expect(msg.Body).toBe(MessageBody);
      expect(msg.MD5OfBody).toBe(MD5OfMessageBody);
      expect(msg.MessageAttributes).deep.eq(MessageAttributes);
      expect(msg.MD5OfMessageAttributes).toBe(MD5OfMessageAttributes);
      expect(msg.Attributes!.AWSTraceHeader).toBe(AWSTraceHeader);
      expect(msg.Attributes!.DeadLetterQueueSourceArn).toBe(`arn:aws:sqs:us-east-1:123456789012:${SourceQueue}`);
    });
  });

  describe("MessageMoveTask", () => {
    describe("Should fail to start a new Task", () => {
      const SourceArn = "arn:aws:sqs:eu-west-3:123456789012:FAILStartMessageMoveTask_SourceArn";
      const DestinationArn = "arn:aws:sqs:eu-west-3:123456789012:FAILStartMessageMoveTask_DestinationArn";

      beforeAll(async () => {
        await client.send(new CreateQueueCommand({ QueueName: "FAILStartMessageMoveTask_SourceArn" }));

        await client.send(
          new CreateQueueCommand({
            QueueName: "FAILStartMessageMoveTask_DestinationArn",
            Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: SourceArn, maxReceiveCount: 2 }) },
          })
        );
      });

      it("without SourceArn", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new StartMessageMoveTaskCommand({}));
        }).rejects.toThrow("The request must contain the parameter SourceArn.");
      });

      it("with empty SourceArn", () => {
        expect(async () => {
          await client.send(new StartMessageMoveTaskCommand({ SourceArn: "" }));
        }).rejects.toThrow("You must use this format to specify the SourceArn: arn:<partition>:<service>:<region>:<account-id>:<resource-id>");
      });

      it("with invalid SourceArn type (object)", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new StartMessageMoveTaskCommand({ SourceArn: {} }));
        }).rejects.toThrow("Start of structure or map found where not expected.");
      });

      it("with invalid SourceArn type (array)", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new StartMessageMoveTaskCommand({ SourceArn: [] }));
        }).rejects.toThrow("Start of list found where not expected");
      });

      it("with inexisting SourceArn", () => {
        expect(async () => {
          await client.send(new StartMessageMoveTaskCommand({ SourceArn: "arn:aws:sqs:eu-west-3:123456789012:IDontExist" }));
        }).rejects.toThrow("The resource that you specified for the SourceArn parameter doesn't exist.");
      });

      it("without DLQ Policy SourceArn Queue", () => {
        expect(async () => {
          await client.send(new CreateQueueCommand({ QueueName: "ImNotDLQ" }));
          await client.send(new StartMessageMoveTaskCommand({ SourceArn: "arn:aws:sqs:eu-west-3:123456789012:ImNotDLQ" }));
        }).rejects.toThrow("Source queue must be configured as a Dead Letter Queue.");
      });

      it("with invalid DestinationArn", () => {
        expect(async () => {
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: "invalid" }));
        }).rejects.toThrow("You must use this format to specify the DestinationArn: arn:<partition>:<service>:<region>:<account-id>:<resource-id>");
      });

      it("with inexisting DestinationArn", () => {
        expect(async () => {
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: "arn:aws:sqs:eu-west-3:123456789012:IDontExist" }));
        }).rejects.toThrow("The resource that you specified for the DestinationArn parameter doesn't exist.");
      });

      it("with same ARN", () => {
        expect(async () => {
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: SourceArn }));
        }).rejects.toThrow("Source queue arn and destination queue arn cannot be the same.");
      });

      it("with invalid MaxNumberOfMessagesPerSecond (-)", () => {
        expect(async () => {
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: 0 }));
        }).rejects.toThrow("Value for parameter MaxNumberOfMessagesPerSecond is invalid. Reason: You must enter a number that's between 1 and 500.");
      });

      it("with invalid MaxNumberOfMessagesPerSecond (+)", () => {
        expect(async () => {
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: 509 }));
        }).rejects.toThrow("Value for parameter MaxNumberOfMessagesPerSecond is invalid. Reason: You must enter a number that's between 1 and 500.");
      });

      it("with empty DestinationArn", () => {
        expect(async () => {
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: "" }));
        }).rejects.toThrow("You must use this format to specify the DestinationArn: arn:<partition>:<service>:<region>:<account-id>:<resource-id>");
      });

      it("with invalid DestinationArn type (object)", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: {} }));
        }).rejects.toThrow("Start of structure or map found where not expected.");
      });

      it("with invalid DestinationArn type (array)", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: [] }));
        }).rejects.toThrow("Start of list found where not expected");
      });

      it("with empty MaxNumberOfMessagesPerSecond", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: "" }));
        }).rejects.toThrow("STRING_VALUE can not be converted to an Integer");
      });

      it("with multi empty MaxNumberOfMessagesPerSecond", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: " " }));
        }).rejects.toThrow("STRING_VALUE can not be converted to an Integer");
      });

      it("with invalid MaxNumberOfMessagesPerSecond type (object)", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: {} }));
        }).rejects.toThrow("Start of structure or map found where not expected.");
      });

      it("with invalid MaxNumberOfMessagesPerSecond type (array)", () => {
        expect(async () => {
          // @ts-expect-error
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: [] }));
        }).rejects.toThrow("Start of list found where not expected");
      });

      it("with invalid Source/Destination Queue Type", () => {
        expect(async () => {
          await client.send(new CreateQueueCommand({ QueueName: "Destination.fifo", Attributes: { FifoQueue: "true" } }));
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn: "arn:aws:sqs:eu-west-3:123456789012:Destination.fifo" }));
        }).rejects.toThrow("The source queue and destination queue must be of the same queue type.");
      });

      it("when a Task is already running", () => {
        expect(async () => {
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: 1 }));
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: 1 }));
        }).rejects.toThrow("There is already a task running. Only one active task is allowed for a source queue arn at a given time.");
      });
    });

    describe("Should pass", () => {
      const SourceQueueName = "PASSStartMessageMoveTask_SourceArn";
      const SourceArn = `arn:aws:sqs:eu-west-3:123456789012:${SourceQueueName}`;

      const DestinationQueueName = "PASSStartMessageMoveTask_DestinationArn";
      const DestinationArn = `arn:aws:sqs:eu-west-3:123456789012:${DestinationQueueName}`;

      beforeAll(async () => {
        await client.send(new CreateQueueCommand({ QueueName: SourceQueueName }));

        await client.send(
          new CreateQueueCommand({
            QueueName: DestinationQueueName,
            Attributes: { VisibilityTimeout: "2", RedrivePolicy: JSON.stringify({ deadLetterTargetArn: SourceArn, maxReceiveCount: 2 }) },
          })
        );
      });

      it("return valid TaskHandle", async () => {
        const res = await client.send(new StartMessageMoveTaskCommand({ SourceArn }));

        const TaskHandle = JSON.parse(Buffer.from(res.TaskHandle!, "base64").toString("utf-8"));
        expect(TaskHandle.taskId).toBeTypeOf("string");
        expect(TaskHandle.sourceArn).toBe(SourceArn);
      });

      it(
        "by moving messages back to default Destiantion",
        async () => {
          const SourceQueueName = "PASSStartMessageMoveTask_SourceArn2";
          const SourceArn = `arn:aws:sqs:eu-west-3:123456789012:${SourceQueueName}`;

          const DestinationQueueName = "PASSStartMessageMoveTask_DestinationArn2";
          const DestinationArn = `arn:aws:sqs:eu-west-3:123456789012:${DestinationQueueName}`;

          await client.send(new CreateQueueCommand({ QueueName: SourceQueueName }));

          await client.send(
            new CreateQueueCommand({
              QueueName: DestinationQueueName,
              Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: SourceArn, maxReceiveCount: 2 }) },
            })
          );

          await client.send(
            new SendMessageCommand({
              QueueUrl: DestinationQueueName,
              MessageBody: "Hello, World!",
              MessageAttributes: { Hello: { DataType: "String", StringValue: "World!" } },
              MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "trace-id=1" } },
            })
          );
          await client.send(
            new ReceiveMessageCommand({
              QueueUrl: DestinationQueueName,
              VisibilityTimeout: 0,
              // @ts-ignore
              AttributeNames: ["ApproximateReceiveCount"],
              MaxNumberOfMessages: 10,
              WaitTimeSeconds: 3,
            })
          );

          const { Attributes } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["All"] }));

          expect(Attributes?.ApproximateNumberOfMessages).toBe("1");

          const res2 = await client.send(
            new ReceiveMessageCommand({
              QueueUrl: DestinationQueueName,
            })
          );
          expect(res2.Messages).toBeUndefined();

          await client.send(new StartMessageMoveTaskCommand({ SourceArn }));

          await sleep(2);

          const { Attributes: sourceAttribs } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["ApproximateNumberOfMessages"] }));
          const { Attributes: destinationAttribs } = await client.send(
            new GetQueueAttributesCommand({ QueueUrl: DestinationQueueName, AttributeNames: ["ApproximateNumberOfMessages"] })
          );

          expect(sourceAttribs?.ApproximateNumberOfMessages).toBe("0");
          expect(destinationAttribs?.ApproximateNumberOfMessages).toBe("1");
        },
        { timeout: 20 * 1000 }
      );

      it(
        "by moving messages to a custom Destiantion",
        async () => {
          const SourceQueueName = "PASSStartMessageMoveTask_SourceArn3";
          const SourceArn = `arn:aws:sqs:eu-west-3:123456789012:${SourceQueueName}`;

          const DestinationQueueName = "PASSStartMessageMoveTask_DestinationArn3";
          const DestinationArn = `arn:aws:sqs:eu-west-3:123456789012:${DestinationQueueName}`;

          await client.send(
            new CreateQueueCommand({
              QueueName: DestinationQueueName,
            })
          );

          await client.send(
            new CreateQueueCommand({ QueueName: SourceQueueName, Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: DestinationArn, maxReceiveCount: 2 }) } })
          );

          await client.send(
            new SendMessageCommand({
              QueueUrl: DestinationQueueName,
              MessageBody: "Hello, World!",
              MessageAttributes: { Hello: { DataType: "String", StringValue: "World!" } },
              MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "trace-id=1" } },
            })
          );

          const { Attributes } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["All"] }));

          expect(Attributes?.ApproximateNumberOfMessages).toBe("0");

          await client.send(new StartMessageMoveTaskCommand({ SourceArn: DestinationArn, DestinationArn: SourceArn }));

          await sleep(2);

          const { Attributes: destinationAttribs } = await client.send(
            new GetQueueAttributesCommand({ QueueUrl: DestinationQueueName, AttributeNames: ["ApproximateNumberOfMessages"] })
          );
          expect(destinationAttribs?.ApproximateNumberOfMessages).toBe("0");

          const { Attributes: sourceAttribs } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["ApproximateNumberOfMessages"] }));
          expect(sourceAttribs?.ApproximateNumberOfMessages).toBe("1");
        },
        { timeout: 20 * 1000 }
      );

      it(
        "with failure (CouldNotDetermineMessageSource)",
        async () => {
          const SourceQueueName = "PASSStartMessageMoveTask_SourceArn4";
          const SourceArn = `arn:aws:sqs:eu-west-3:123456789012:${SourceQueueName}`;

          const DestinationQueueName = "PASSStartMessageMoveTask_DestinationArn4";

          await client.send(
            new CreateQueueCommand({
              QueueName: SourceQueueName,
            })
          );

          await client.send(
            new CreateQueueCommand({ QueueName: DestinationQueueName, Attributes: { RedrivePolicy: JSON.stringify({ deadLetterTargetArn: SourceArn, maxReceiveCount: 2 }) } })
          );

          await client.send(
            new SendMessageCommand({
              QueueUrl: SourceQueueName,
              MessageBody: "Hello, World!",
              MessageAttributes: { Hello: { DataType: "String", StringValue: "World!" } },
              MessageSystemAttributes: { AWSTraceHeader: { DataType: "String", StringValue: "trace-id=1" } },
            })
          );
          await sleep(1);
          const { Attributes } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["All"] }));

          expect(Attributes?.ApproximateNumberOfMessages).toBe("1");
          const MaxNumberOfMessagesPerSecond = 93;
          await client.send(new StartMessageMoveTaskCommand({ SourceArn, MaxNumberOfMessagesPerSecond }));

          await sleep(2);

          const { Attributes: sourceAttribs } = await client.send(new GetQueueAttributesCommand({ QueueUrl: SourceQueueName, AttributeNames: ["ApproximateNumberOfMessages"] }));
          expect(sourceAttribs?.ApproximateNumberOfMessages).toBe("1");

          const { Results } = await client.send(new ListMessageMoveTasksCommand({ SourceArn }));

          expect(Results).toHaveLength(1);

          const [task] = Results!;

          expect(task.ApproximateNumberOfMessagesMoved).toBe(0);
          expect(task.ApproximateNumberOfMessagesToMove).toBe(1);
          expect(task.FailureReason).toBe("CouldNotDetermineMessageSource");
          expect(task.MaxNumberOfMessagesPerSecond).toBe(MaxNumberOfMessagesPerSecond);
          expect(task.SourceArn).toBe(SourceArn);
          expect(new Date(task.StartedTimestamp!).getFullYear()).toBe(new Date().getFullYear()); // is valid date timestamp
          expect(task.Status).toBe("FAILED");
          expect(task.TaskHandle).toBeUndefined();
        },
        { timeout: 20 * 1000 }
      );

      it(
        "start and cancel task",
        async () => {
          const Entries: { Id: string; MessageBody: string }[] = [];

          let i = 1;

          while (i < 11) {
            Entries.push({ Id: `id-${i}`, MessageBody: `message ${i}` });
            i++;
          }

          await client.send(new SendMessageBatchCommand({ QueueUrl: SourceQueueName, Entries }));

          const { TaskHandle } = await client.send(new StartMessageMoveTaskCommand({ SourceArn, DestinationArn, MaxNumberOfMessagesPerSecond: 1 }));

          await sleep(3);

          const { ApproximateNumberOfMessagesMoved } = await client.send(new CancelMessageMoveTaskCommand({ TaskHandle }));

          expect(ApproximateNumberOfMessagesMoved).greaterThan(1);

          const { Results } = await client.send(new ListMessageMoveTasksCommand({ SourceArn }));

          const [cancellingTask] = Results!;

          expect(["CANCELLING", "CANCELLED"]).toContain(cancellingTask.Status);
          // expect(cancellingTask.Status).toBe("CANCELLING");  depending on CPU speed / event loops we may "lose" this step
          expect(cancellingTask.SourceArn).toBe(SourceArn);
          expect(cancellingTask.DestinationArn).toBe(DestinationArn);
          expect(cancellingTask.ApproximateNumberOfMessagesToMove).toBe(10);
          await sleep(2);

          const { Results: Results2 } = await client.send(new ListMessageMoveTasksCommand({ SourceArn }));
          const [cancelledTask] = Results2!;
          expect(cancelledTask.Status).toBe("CANCELLED");
        },
        { timeout: 10 * 1000 }
      );
    });
  });
});
