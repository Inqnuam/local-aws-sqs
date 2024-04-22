import { SqsCommand } from "./sqsCommand";
import { md5OfMessageAttributes } from "aws-md5-of-message-attributes";
import { xmlVersion, xmlns, ResponseMetadata } from "../common/responses";
import { verifyQueueAttribValue } from "../common/utils";
import { InvalidParameterValueException, MalformedInputException } from "../common/errors";

export class ReceiveMessage extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    this.#setBody();

    const { VisibilityTimeout, WaitTimeSeconds, MaxNumberOfMessages, AttributeNames, MessageAttributeNames } = this.body;

    const response = await this.foundQueue!.receive({ VisibilityTimeout, WaitTimeSeconds, MaxNumberOfMessages });

    this.res.end(this.#createResponse(response, AttributeNames, MessageAttributeNames));
  }

  #setBody() {
    if (!this.isJsonProtocol) {
      if ("AttributeName" in this.reqBody) {
        this.reqBody.AttributeNames = this.reqBody.AttributeName;
        delete this.reqBody.AttributeName;
      }

      if ("MessageAttributeName" in this.reqBody) {
        this.reqBody.MessageAttributeNames = this.reqBody.MessageAttributeName;
        delete this.reqBody.MessageAttributeName;
      }
    }

    this.body = this.reqBody;

    if ("MaxNumberOfMessages" in this.body) {
      const errMsg = verifyQueueAttribValue.MaxNumberOfMessages(this.body.MaxNumberOfMessages);

      if (errMsg) {
        throw errMsg;
      }
    }

    if ("WaitTimeSeconds" in this.body) {
      const errMsg = verifyQueueAttribValue.ReceiveMessageWaitTimeSeconds(this.body.WaitTimeSeconds);

      if (errMsg) {
        if (errMsg instanceof MalformedInputException) {
          throw errMsg;
        }

        throw new InvalidParameterValueException(`Value ${this.body.WaitTimeSeconds} for parameter WaitTimeSeconds is invalid. Reason: Must be >= 0 and <= 20, if provided.`);
      }
    }

    if ("VisibilityTimeout" in this.body) {
      const errMsg = verifyQueueAttribValue.VisibilityTimeout(this.body.VisibilityTimeout);

      if (errMsg) {
        if (errMsg instanceof MalformedInputException) {
          throw errMsg;
        }

        throw new InvalidParameterValueException(
          `Value ${this.body.VisibilityTimeout} for parameter VisibilityTimeout is invalid. Reason: Must be >= 0 and <= 43200, if provided.`
        );
      }
    }

    // NOTE check ReceiveRequestAttemptId implementation (available only for FIFO)
  }
  #createResponse(records: any[], AttributeNames: string[], MessageAttributeNames: string[]) {
    if (this.isJsonProtocol) {
      if (!records.length) {
        return;
      }

      const response = {
        Messages: records.map((x) => {
          const m: Record<string, any> = {
            Body: x.MessageBody,
            MD5OfBody: x.MD5OfMessageBody,
            MessageId: x.MessageId,
            ReceiptHandle: x.ReceiptHandle,
          };

          if (Array.isArray(AttributeNames)) {
            const hasAllAttrib = AttributeNames.find((x) => x == "All");
            let Attributes: Record<string, any> = {};

            if (hasAllAttrib) {
              Attributes = x.attributes;
            } else {
              AttributeNames.forEach((attributeName) => {
                const attrValue = x.attributes[attributeName];
                if (attrValue) {
                  Attributes[attributeName] = attrValue;
                }
              });
            }

            if (Object.keys(Attributes).length) {
              m.Attributes = Attributes;
            }
          }

          if (Array.isArray(MessageAttributeNames) && x.MessageAttributes) {
            const hasAllAttrib = MessageAttributeNames.find((x) => x == "All" || x == ".*");
            let collectMsgAttrbs: Record<string, any> = {};

            if (hasAllAttrib) {
              collectMsgAttrbs = x.MessageAttributes;
            } else {
              MessageAttributeNames.forEach((attribName) => {
                const keys = Object.keys(x.MessageAttributes).filter((a) => {
                  if (attribName.endsWith(".*")) {
                    const prefix = attribName.split(".")[0];
                    return a.startsWith(prefix);
                  }
                  return a == attribName;
                });
                if (!keys.length) {
                  return;
                }

                keys.forEach((key) => {
                  const attrib = x.MessageAttributes[key];
                  if (attrib) {
                    collectMsgAttrbs[key] = attrib;
                  }
                });
              });
            }

            if (Object.keys(collectMsgAttrbs).length) {
              m.MessageAttributes = collectMsgAttrbs;
              m.MD5OfMessageAttributes = md5OfMessageAttributes(collectMsgAttrbs);
            }
          }

          return m;
        }),
      };

      return JSON.stringify(response);
    }

    let ReceiveMessageResult = "<ReceiveMessageResult>\n";

    if (records.length) {
      records.forEach((record) => {
        ReceiveMessageResult += `<Message>
          <MessageId>${record.MessageId}</MessageId>
          <ReceiptHandle>${record.ReceiptHandle}</ReceiptHandle>
          <MD5OfBody>${record.MD5OfMessageBody}</MD5OfBody>
          <Body>${record.MessageBody.replace(/"/g, "&quot;")}</Body>\n`;

        if (Array.isArray(AttributeNames)) {
          const hasAllAttrib = AttributeNames.find((x) => x == "All");
          if (hasAllAttrib) {
            Object.entries(record.attributes).forEach((x) => {
              const [k, v] = x;
              ReceiveMessageResult += `<Attribute>
                <Name>${k}</Name>
                <Value>${v}</Value>
            </Attribute>\n`;
            });
          } else {
            AttributeNames.forEach((x) => {
              if (record.attributes[x]) {
                ReceiveMessageResult += `<Attribute>
                  <Name>${x}</Name>
                  <Value>${record.attributes[x]}</Value>
              </Attribute>\n`;
              }
            });
          }
        }

        if (record.MessageAttributes && Array.isArray(MessageAttributeNames)) {
          const hasAllAttrib = MessageAttributeNames.find((x) => x == "All" || x == ".*");
          let collectMsgAttrbs: any = {};

          if (hasAllAttrib) {
            collectMsgAttrbs = record.MessageAttributes;
            Object.entries(record.MessageAttributes).forEach((x) => {
              const [k, v]: [string, any] = x;

              const Value = v.DataType.startsWith("B") ? `<BinaryValue>${v.BinaryValue}</BinaryValue>` : `<StringValue>${v.StringValue}</StringValue>`;
              ReceiveMessageResult += `<MessageAttribute>
                <Name>${k}</Name>
                <Value>
                  ${Value}
                  <DataType>${v.DataType}</DataType>
                </Value>
            </MessageAttribute>\n`;
            });
          } else {
            MessageAttributeNames.forEach((x) => {
              const keys = Object.keys(record.MessageAttributes).filter((a) => {
                if (x.endsWith(".*")) {
                  const prefix = x.split(".")[0];
                  return a.startsWith(prefix);
                }
                return a == x;
              });
              if (!keys.length) {
                return;
              }

              keys.forEach((key) => {
                const attrib = record.MessageAttributes[key];
                if (attrib) {
                  collectMsgAttrbs[key] = {
                    DataType: attrib.DataType,
                  };

                  let Value: string = "";

                  if (attrib.DataType.startsWith("B")) {
                    collectMsgAttrbs[key].BinaryValue = attrib.BinaryValue;
                    Value = `<BinaryValue>${attrib.BinaryValue}</BinaryValue>`;
                  } else {
                    collectMsgAttrbs[key].StringValue = attrib.StringValue;
                    Value = `<StringValue>${attrib.StringValue}</StringValue>`;
                  }

                  ReceiveMessageResult += `<MessageAttribute>
                  <Name>${key}</Name>
                  <Value>
                    ${Value}
                    <DataType>${attrib.DataType}</DataType>
                  </Value>
              </MessageAttribute>\n`;
                }
              });
            });
          }

          if (Object.keys(collectMsgAttrbs).length) {
            ReceiveMessageResult += `<MD5OfMessageAttributes>${md5OfMessageAttributes(collectMsgAttrbs)}</MD5OfMessageAttributes>`;
          }
        }

        ReceiveMessageResult += "</Message>\n";
      });
      ReceiveMessageResult += "</ReceiveMessageResult>";
    } else {
      ReceiveMessageResult = "<ReceiveMessageResult/>\n";
    }

    const body = `${xmlVersion}
    <ReceiveMessageResponse ${xmlns}>
       ${ReceiveMessageResult}  
       ${ResponseMetadata(this.RequestId)}
    </ReceiveMessageResponse>`;

    return body;
  }
}
