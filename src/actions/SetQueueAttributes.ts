import { SqsCommand } from "./sqsCommand";
import { type IQueueConfig } from "../lib/queue";
import { InvalidAttributeNameException, MissingParameterException, UnexcpectedList, throwOnNoPrimitiveType } from "../common/errors";
import { isJsObject } from "../common/utils";
import { setAttributes } from "../lib/setAttributes";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

const ALLOWED_ATTRIBUTE_NAMES = [
  "DelaySeconds",
  "MaximumMessageSize",
  "MessageRetentionPeriod",
  "Policy",
  "ReceiveMessageWaitTimeSeconds",
  "VisibilityTimeout",
  "RedrivePolicy",
  "RedriveAllowPolicy",
  "KmsMasterKeyId",
  "KmsDataKeyReusePeriodSeconds",
  "SqsManagedSseEnabled",
  "ContentBasedDeduplication",
  "DeduplicationScope",
  "FifoThroughputLimit",
];

const verifyAttributes = (Attributes: Record<string, any>) => {
  const keys = Object.keys(Attributes);

  if (!keys.length) {
    throw MissingAttributeName;
  }

  for (const k of keys) {
    const v = Attributes[k];

    throwOnNoPrimitiveType(v);

    if (!ALLOWED_ATTRIBUTE_NAMES.includes(k)) {
      throw new InvalidAttributeNameException(`Unknown Attribute ${k}.`);
    }
  }
};

const MissingAttributeName = new MissingParameterException("The request must contain the parameter Attribute.Name.");
const MissingAttributeValue = new MissingParameterException("The request must contain the parameter Attribute.Value.");

export class SetQueueAttributes extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    this.#setBody();

    const q = this.foundQueue!;

    const currentAttribs: IQueueConfig = {
      QueueName: q.QueueName,
      Tags: {},
      ContentBasedDeduplication: q.ContentBasedDeduplication,
      DeduplicationScope: q.DeduplicationScope,
      FifoQueue: q.FifoQueue,
      FifoThroughputLimit: q.FifoThroughputLimit,
    };
    setAttributes(currentAttribs, this.body.Attributes, this.service, false);

    const updatedAttribs: any = {};

    for (const k of Object.keys(this.body.Attributes)) {
      updatedAttribs[k] = currentAttribs[k as keyof typeof currentAttribs];
    }

    q.setAttributes(updatedAttribs);
    this.res.end(this.#createResponse());
  }

  #setBody() {
    this.body = this.isJsonProtocol ? this.reqBody : this.#getAmzQueryBody();

    const Attributes = this.body.Attributes;
    if (!Attributes) {
      throw MissingAttributeName;
    }

    if (Array.isArray(Attributes)) {
      throw UnexcpectedList;
    }

    if (!isJsObject(Attributes)) {
      throw MissingAttributeName;
    }

    verifyAttributes(Attributes);
  }

  #getAmzQueryBody() {
    const { Attribute } = this.reqBody;
    const body: any = { Attributes: {} };

    if (!Array.isArray(Attribute)) {
      return;
    }

    for (const attrib of Attribute) {
      if (!isJsObject(attrib)) {
        throw MissingAttributeName;
      }

      if (!("Name" in attrib)) {
        throw MissingAttributeName;
      }

      if (!("Value" in attrib)) {
        throw MissingAttributeValue;
      }

      const { Name, Value } = attrib;

      body.Attributes[Name] = Value;
    }

    return body;
  }

  #createResponse() {
    if (this.isJsonProtocol) {
      return;
    }

    return `${xmlVersion}<SetQueueAttributesResponse ${xmlns}>
    ${ResponseMetadata(this.RequestId)}
  </SetQueueAttributesResponse>`;
  }
}
