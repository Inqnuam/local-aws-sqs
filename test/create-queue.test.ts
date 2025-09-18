import { describe, it, expect, afterAll } from "vitest";
import { GetQueueAttributesCommand, CreateQueueCommand } from "@aws-sdk/client-sqs";
import { createServerAndCli } from "./utils";

const AWS_ACCOUNT_ID = 123456789012;
const StandartQueueName = "MyQueue";
const FifoQueueName = "MyFifoQueue.fifo";

const { PORT, client, server } = await createServerAndCli();

describe("Create Queue", () => {
  afterAll(() => {
    server.close();
  });

  describe("Should fail", () => {
    it("with missing QueueName", async () => {
      await expect(async () => {
        // @ts-expect-error
        await client.send(new CreateQueueCommand({}));
      }).rejects.toThrow("Value for parameter QueueName is invalid. Reason: Must specify a queue name.");
    });

    it("with empty QueueName", async () => {
      await expect(async () => {
        await client.send(new CreateQueueCommand({ QueueName: "" }));
      }).rejects.toThrow("Queue name cannot be empty");
    });

    it("with invalid Standart Queue name", async () => {
      await expect(async () => {
        await client.send(new CreateQueueCommand({ QueueName: "example.fifo" }));
      }).rejects.toThrow("Can only include alphanumeric characters, hyphens, or underscores. 1 to 80 in length");
    });

    it("with invalid Standart Queue Attribute (FifoQueue)", async () => {
      await expect(async () => {
        await client.send(new CreateQueueCommand({ QueueName: "example", Attributes: { FifoQueue: "true" } }));
      }).rejects.toThrow("Unknown Attribute FifoQueue.");
    });

    it("with invalid FIFO Queue name", async () => {
      await expect(async () => {
        await client.send(new CreateQueueCommand({ QueueName: "example.ifo", Attributes: { FifoQueue: "true" } }));
      }).rejects.toThrow("Unknown Attribute FifoQueue.");
    });

    it("with invalid FIFO Queue Attribute", async () => {
      await expect(async () => {
        await client.send(new CreateQueueCommand({ QueueName: "example.fifo", Attributes: { FifoQueue: "false" } }));
      }).rejects.toThrow("Unknown Attribute FifoQueue.");
    });

    it("with invalid name", async () => {
      await expect(async () => {
        await client.send(new CreateQueueCommand({ QueueName: "in.fo" }));
      }).rejects.toThrow("Can only include alphanumeric characters, hyphens, or underscores. 1 to 80 in length");

      await expect(async () => {
        await client.send(new CreateQueueCommand({ QueueName: "ééwwà)" }));
      }).rejects.toThrow("Can only include alphanumeric characters, hyphens, or underscores. 1 to 80 in length");
    });

    describe("with invalid Attributes type", () => {
      it("as array", async () => {
        await expect(async () => {
          // @ts-expect-error
          await client.send(new CreateQueueCommand({ QueueName: "InvalidAttrib", Attributes: ["dummy"] }));
        }).rejects.toThrow("Unknown Attribute 0.");
      });

      it("as string", async () => {
        await expect(async () => {
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
        it("with object", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: {} } }));
          }).rejects.toThrow("Start of structure or map found where not expected.");
        });

        it("with array", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: [] } }));
          }).rejects.toThrow("Unrecognized collection type class java.lang.String");
        });

        it("with boolean", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: true } }));
          }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
        });
        it("with empty", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: "" } }));
          }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
        });

        it("with empty char and number", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: " 6" } }));
          }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
        });

        it("with signed int", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: "-45" } }));
          }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
        });

        it("with above max allowed value", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { DelaySeconds: "901" } }));
          }).rejects.toThrow("Invalid value for the parameter DelaySeconds.");
        });

        it("with float", async () => {
          await expect(async () => {
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
        it("with object", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: {} } }));
          }).rejects.toThrow("Start of structure or map found where not expected.");
        });

        it("with array", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: [] } }));
          }).rejects.toThrow("Unrecognized collection type class java.lang.String");
        });

        it("with boolean", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: true } }));
          }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
        });
        it("with empty", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: "" } }));
          }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
        });

        it("with empty char and number", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: " 2000" } }));
          }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
        });

        it("with below min allowed value", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: "1000" } }));
          }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
        });

        it("with above max allowed value", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MaximumMessageSize: "1048577" } }));
          }).rejects.toThrow("Invalid value for the parameter MaximumMessageSize.");
        });

        it("with float", async () => {
          await expect(async () => {
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
          expect(res.Attributes!.MaximumMessageSize).toBe("1048576");
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
        it("with object", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: {} } }));
          }).rejects.toThrow("Start of structure or map found where not expected.");
        });

        it("with array", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: [] } }));
          }).rejects.toThrow("Unrecognized collection type class java.lang.String");
        });

        it("with boolean", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: true } }));
          }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
        });
        it("with empty", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: "" } }));
          }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
        });

        it("with empty char and number", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: " 2000" } }));
          }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
        });

        it("with below min allowed value", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: "50" } }));
          }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
        });

        it("with above max allowed value", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { MessageRetentionPeriod: "1209601" } }));
          }).rejects.toThrow("Invalid value for the parameter MessageRetentionPeriod.");
        });

        it("with float", async () => {
          await expect(async () => {
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

        it("with no JSON parsable string", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: "badjson" } }));
          }).rejects.toThrow("Invalid value for the parameter Policy.");
        });

        it("with invalid JSON Policy type (array)", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify([]) } }));
          }).rejects.toThrow("Invalid value for the parameter Policy.");
        });

        it("with invalid JSON Policy type (string)", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify("string") } }));
          }).rejects.toThrow("Invalid value for the parameter Policy.");
        });

        it("with invalid JSON Policy type (number)", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify(533) } }));
          }).rejects.toThrow("Invalid value for the parameter Policy.");
        });
        it("with invalid JSON Policy type (null)", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify(null) } }));
          }).rejects.toThrow("Invalid value for the parameter Policy.");
        });

        it("with unknown Policy field", async () => {
          await expect(async () => {
            await client.send(
              new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify({ Dummyfield: "dummyvalue", Version: "2012-10-17", Statement: [Statement] }) } })
            );
          }).rejects.toThrow("Invalid value for the parameter Policy.");
        });

        it("with invalid Policy Version", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify({ Version: "4532-10-17", Statement: [Statement] }) } }));
          }).rejects.toThrow("Invalid value for the parameter Policy.");
        });

        it("with empty Policy Statement", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify({ Version: "2012-10-17", Statement: [] }) } }));
          }).rejects.toThrow("Invalid value for the parameter Policy.");
        });

        it("with unknown Policy Statement (object) field", async () => {
          await expect(async () => {
            await client.send(
              new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify({ Version: "2012-10-17", Statement: { ...Statement, dummy: "value" } }) } })
            );
          }).rejects.toThrow("Invalid value for the parameter Policy.");
        });

        it("with unknown Policy Statement (array) field", async () => {
          await expect(async () => {
            await client.send(
              new CreateQueueCommand({ QueueName, Attributes: { Policy: JSON.stringify({ Version: "2012-10-17", Statement: [{ ...Statement, dummy: "value" }] }) } })
            );
          }).rejects.toThrow("Invalid value for the parameter Policy.");
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
        it("with object", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: {} } }));
          }).rejects.toThrow("Start of structure or map found where not expected.");
        });

        it("with array", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: [] } }));
          }).rejects.toThrow("Unrecognized collection type class java.lang.String");
        });

        it("with boolean", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: true } }));
          }).rejects.toThrow("Invalid value for the parameter ReceiveMessageWaitTimeSeconds.");
        });
        it("with empty", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: "" } }));
          }).rejects.toThrow("Invalid value for the parameter ReceiveMessageWaitTimeSeconds.");
        });

        it("with empty char and number", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: " 2" } }));
          }).rejects.toThrow("Invalid value for the parameter ReceiveMessageWaitTimeSeconds.");
        });

        it("with below min allowed value", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { ReceiveMessageWaitTimeSeconds: "-50" } }));
          }).rejects.toThrow("Invalid value for the parameter ReceiveMessageWaitTimeSeconds.");
        });

        it("with above max allowed value", async () => {
          await expect(async () => {
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
        it("with object", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: {} } }));
          }).rejects.toThrow("Start of structure or map found where not expected.");
        });

        it("with array", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: [] } }));
          }).rejects.toThrow("Unrecognized collection type class java.lang.String");
        });

        it("with boolean", async () => {
          await expect(async () => {
            //@ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: true } }));
          }).rejects.toThrow("Invalid value for the parameter VisibilityTimeout.");
        });
        it("with empty", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: "" } }));
          }).rejects.toThrow("Invalid value for the parameter VisibilityTimeout.");
        });

        it("with empty char and number", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: " 2" } }));
          }).rejects.toThrow("Invalid value for the parameter VisibilityTimeout.");
        });

        it("with below min allowed value", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: "InvalidAttribValueQueue", Attributes: { VisibilityTimeout: "-50" } }));
          }).rejects.toThrow("Invalid value for the parameter VisibilityTimeout.");
        });

        it("with above max allowed value", async () => {
          await expect(async () => {
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

        it("with invalid JSON value", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: InvalidAttribQueueName, Attributes: { RedrivePolicy: " " } }));
          }).rejects.toThrow("Invalid value for the parameter RedrivePolicy. Reason: Redrive policy is not a valid JSON map.");
        });
        it("with invalid JSON value (number)", async () => {
          await expect(async () => {
            // @ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: InvalidAttribQueueName, Attributes: { RedrivePolicy: 4 } }));
          }).rejects.toThrow("Invalid value for the parameter RedrivePolicy. Reason: Redrive policy is not a valid JSON map.");
        });
        it("with invalid JSON value (array)", async () => {
          await expect(async () => {
            // @ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: InvalidAttribQueueName, Attributes: { RedrivePolicy: [] } }));
          }).rejects.toThrow("Invalid value for the parameter RedrivePolicy. Reason: Redrive policy is not a valid JSON map.");
        });

        it("with missing maxReceiveCount", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: InvalidAttribQueueName, Attributes: { RedrivePolicy: JSON.stringify({}) } }));
          }).rejects.toThrow("Value {} for parameter RedrivePolicy is invalid. Reason: Redrive policy does not contain mandatory attribute: maxReceiveCount.");
        });

        it("with missing deadLetterTargetArn", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: InvalidAttribQueueName, Attributes: { RedrivePolicy: JSON.stringify({ maxReceiveCount: 5 }) } }));
          }).rejects.toThrow(
            'Value {"maxReceiveCount":5} for parameter RedrivePolicy is invalid. Reason: Redrive policy does not contain mandatory attribute: deadLetterTargetArn.'
          );
        });

        it("with invalid maxReceiveCount (-)", async () => {
          await expect(async () => {
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

        it("with invalid maxReceiveCount (+)", async () => {
          await expect(async () => {
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

        it("with invalid deadLetterTargetArn", async () => {
          await expect(async () => {
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

        it("with invalid deadLetterTargetArn Queue type", async () => {
          await expect(async () => {
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

        it("with inexisting deadLetterTargetArn Queue", async () => {
          await expect(async () => {
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

        it("with unexcpected parameters", async () => {
          await expect(async () => {
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
        it("with invalid type (array)", async () => {
          await expect(async () => {
            // @ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: [] } }));
          }).rejects.toThrow("Unrecognized collection type class java.lang.String");
        });
        it("with invalid type (object)", async () => {
          await expect(async () => {
            // @ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: {} } }));
          }).rejects.toThrow("Start of structure or map found where not expected");
        });

        it("with invalid type (number)", async () => {
          await expect(async () => {
            // @ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: 444 } }));
          }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
        });
        it("with invalid type (boolean)", async () => {
          await expect(async () => {
            // @ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: false } }));
          }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
        });

        it("with invalid type (string)", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: "badjson" } }));
          }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
        });

        it("with invalid JSON type (array)", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: JSON.stringify([]) } }));
          }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
        });

        it("without redrivePermission", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: JSON.stringify({}) } }));
          }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
        });

        it("with invalid redrivePermission", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "dummy" }) } }));
          }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
        });

        it("with unknown field", async () => {
          await expect(async () => {
            await client.send(
              new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "allowAll", dummy: "value" }) } })
            );
          }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
        });

        it("without sourceQueueArns", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName: QueueUrl, Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "byQueue" }) } }));
          }).rejects.toThrow(
            `Value {"redrivePermission":"byQueue"} for parameter RedriveAllowPolicy is invalid. Reason: Amazon SQS can't create the redrive allow policy. When you specify the byQueue permission type, you must also specify one or more sourceQueueArns values.`
          );
        });

        it("with invalid sourceQueueArns (string)", async () => {
          await expect(async () => {
            await client.send(
              new CreateQueueCommand({
                QueueName: QueueUrl,
                Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "byQueue", sourceQueueArns: "arn:aws:sqs" }) },
              })
            );
          }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
        });

        it("without sourceQueueArns (array-anything-but-string)", async () => {
          await expect(async () => {
            await client.send(
              new CreateQueueCommand({
                QueueName: QueueUrl,
                Attributes: { RedriveAllowPolicy: JSON.stringify({ redrivePermission: "byQueue", sourceQueueArns: [{ dummy: "value" }] }) },
              })
            );
          }).rejects.toThrow("Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.");
        });

        it("with empty sourceQueueArns", async () => {
          await expect(async () => {
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
        it("with too much sourceQueueArns", async () => {
          await expect(async () => {
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

        it("with bad redrivePermission (allowAll) + sourceQueueArns couple", async () => {
          await expect(async () => {
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

        it("with bad redrivePermission (denyAll) + sourceQueueArns couple", async () => {
          await expect(async () => {
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
        it("with invalid KmsDataKeyReusePeriodSeconds", async () => {
          await expect(async () => {
            await client.send(new CreateQueueCommand({ QueueName, Attributes: { KmsDataKeyReusePeriodSeconds: "-233" } }));
          }).rejects.toThrow("Invalid value for the parameter KmsDataKeyReusePeriodSeconds.");
        });

        it("with invalid KmsDataKeyReusePeriodSeconds", async () => {
          await expect(async () => {
            // @ts-expect-error
            await client.send(new CreateQueueCommand({ QueueName, Attributes: { KmsDataKeyReusePeriodSeconds: 86405 } }));
          }).rejects.toThrow("Invalid value for the parameter KmsDataKeyReusePeriodSeconds.");
        });

        it("with invalid SqsManagedSseEnabled + KmsMasterKeyId", async () => {
          await expect(async () => {
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
