import {
  attributeNames,
  DEDUPLICATION_TYPES,
  FIFO_THROUGHPUT_LIMIT_TYPE,
  MAX_KmsDataKeyReusePeriodSeconds,
  MIN_KmsDataKeyReusePeriodSeconds,
  UnsetPolicy,
  UnsetRedriveAllowPolicy,
  UnsetRedrivePolicy,
} from "../common/constants";
import {
  InvalidAttributeNameException,
  SqsError,
  InvalidParameterValueException,
  MalformedInputException,
  InvalidKmsDataKeyReusePeriodSeconds,
  OverLimitException,
} from "../common/errors";
import { verifyQueueAttribValue, isJsObject } from "../common/utils";
import { type IQueueConfig } from "./queue";
import type { SqsService } from "./sqsService";

const setKmsDataKeyReusePeriodSeconds = (config: IQueueConfig, Attributes: Record<string, string>) => {
  if (Attributes.KmsDataKeyReusePeriodSeconds === undefined || Attributes.KmsDataKeyReusePeriodSeconds === null) {
    return;
  }

  if (Attributes.KmsDataKeyReusePeriodSeconds == "" || isNaN(Attributes.KmsDataKeyReusePeriodSeconds as any)) {
    throw InvalidKmsDataKeyReusePeriodSeconds;
  }

  const KmsDataKeyReusePeriodSeconds = Number(Attributes.KmsDataKeyReusePeriodSeconds);

  if (KmsDataKeyReusePeriodSeconds < MIN_KmsDataKeyReusePeriodSeconds || KmsDataKeyReusePeriodSeconds > MAX_KmsDataKeyReusePeriodSeconds) {
    throw InvalidKmsDataKeyReusePeriodSeconds;
  }
  config.KmsDataKeyReusePeriodSeconds = KmsDataKeyReusePeriodSeconds;
};

const setKmsMasterKeyId = (config: IQueueConfig, Attributes: Record<string, string>) => {
  if (Attributes.KmsMasterKeyId === undefined || Attributes.KmsMasterKeyId === null || Attributes.KmsMasterKeyId === "") {
    return;
  }

  if (Array.isArray(Attributes.KmsMasterKeyId)) {
    throw new MalformedInputException("Unrecognized collection type class java.lang.String");
  }

  if (isJsObject(Attributes.KmsMasterKeyId)) {
    throw new MalformedInputException("Start of structure or map found where not expected");
  }

  if (typeof Attributes.KmsMasterKeyId == "number" || typeof Attributes.KmsMasterKeyId == "boolean") {
    config.KmsMasterKeyId = String(Attributes.KmsMasterKeyId);
  }

  if (typeof Attributes.KmsMasterKeyId == "string") {
    config.KmsMasterKeyId = Attributes.KmsMasterKeyId;
  }
};

const parseBoolean = (s: string) => {
  if (s === "true") {
    return true;
  }

  if (s === "false") {
    return false;
  }

  if (typeof s == "boolean") {
    return s;
  }
};

export const setAttributes = (config: IQueueConfig, Attributes: Record<string, string>, sqsService: SqsService, isCreating: boolean = true) => {
  for (const [Name, Value] of Object.entries(Attributes)) {
    switch (Name) {
      case "FifoQueue":
        if (parseBoolean(Value) && config.QueueName.endsWith(".fifo")) {
          config.FifoQueue = true;
        } else {
          throw new InvalidAttributeNameException("Unknown Attribute FifoQueue.");
        }
        break;

      case "DelaySeconds":
        const dsErrMsg = verifyQueueAttribValue.DelaySeconds(Value);
        if (dsErrMsg instanceof SqsError) {
          throw dsErrMsg;
        }

        if (typeof Value != "undefined") {
          config.DelaySeconds = Number(Value);
        }

        break;

      case "MessageRetentionPeriod":
        const maxRetPerErrMsg = verifyQueueAttribValue.MessageRetentionPeriod(Value);
        if (maxRetPerErrMsg instanceof SqsError) {
          throw maxRetPerErrMsg;
        }

        if (Value) {
          config.MessageRetentionPeriod = Number(Value);
        }

        break;

      case "ReceiveMessageWaitTimeSeconds":
        const receiveMsgWaitSecErrMsg = verifyQueueAttribValue.ReceiveMessageWaitTimeSeconds(Value);
        if (receiveMsgWaitSecErrMsg) {
          throw receiveMsgWaitSecErrMsg;
        }

        if (!isNaN(Value as any)) {
          config.ReceiveMessageWaitTimeSeconds = Number(Value);
        }

        break;

      case "VisibilityTimeout":
        const visibTmErrMsg = verifyQueueAttribValue.VisibilityTimeout(Value);
        if (visibTmErrMsg instanceof SqsError) {
          throw visibTmErrMsg;
        }

        if (!isNaN(Value as any)) {
          config.VisibilityTimeout = Number(Value);
        }

        break;

      case "MaximumMessageSize":
        const maxMsgSizeErrMsg = verifyQueueAttribValue.MaximumMessageSize(Value);
        if (maxMsgSizeErrMsg) {
          if (maxMsgSizeErrMsg instanceof SqsError) {
            throw maxMsgSizeErrMsg;
          }

          throw new InvalidParameterValueException(maxMsgSizeErrMsg);
        }

        if (Value) {
          config.MaximumMessageSize = Number(Value);
        }

        break;

      case "SqsManagedSseEnabled":
        const sqsManagedSseEnabledErrMsg = verifyQueueAttribValue.SqsManagedSseEnabled(Value);
        if (sqsManagedSseEnabledErrMsg) {
          throw new InvalidParameterValueException(sqsManagedSseEnabledErrMsg);
        }
        const sqsManagedSseEnabledAsBool = parseBoolean(Value) as boolean;
        if (typeof sqsManagedSseEnabledAsBool == "boolean") {
          config.SqsManagedSseEnabled = sqsManagedSseEnabledAsBool;
        }

        break;

      case "Policy":
        const policyErrMsg = verifyQueueAttribValue.Policy(Value);
        if (policyErrMsg) {
          if (policyErrMsg instanceof OverLimitException) {
            if (isCreating) {
              throw new InvalidParameterValueException(policyErrMsg.message);
            }
            throw policyErrMsg;
          }

          throw new InvalidParameterValueException(policyErrMsg);
        }

        if (Value) {
          config.Policy = JSON.parse(Value);
        } else if (Value == "") {
          config.Policy = new UnsetPolicy();
        }

        break;

      case "RedrivePolicy":
        const redrivePolicyErrMsg = verifyQueueAttribValue.RedrivePolicy(Value);
        if (redrivePolicyErrMsg) {
          throw new InvalidParameterValueException(redrivePolicyErrMsg);
        }

        if (Value) {
          config.RedrivePolicy = JSON.parse(Value);
        } else if (Value == "") {
          config.RedrivePolicy = new UnsetRedrivePolicy();
        }

        break;
      case "RedriveAllowPolicy":
        if (Array.isArray(Value)) {
          throw new MalformedInputException("Unrecognized collection type class java.lang.String");
        }
        if (isJsObject(Value)) {
          throw new MalformedInputException("Start of structure or map found where not expected");
        }
        const redriveAllowPolicyErrMsg = verifyQueueAttribValue.RedriveAllowPolicy(Value);
        if (redriveAllowPolicyErrMsg) {
          throw new InvalidParameterValueException(redriveAllowPolicyErrMsg);
        }

        if (Value) {
          config.RedriveAllowPolicy = JSON.parse(Value);
        } else if (Value == "") {
          config.RedriveAllowPolicy = new UnsetRedriveAllowPolicy();
        }

        break;
      default:
        if (!attributeNames.includes(Name as (typeof attributeNames)[number])) {
          throw new InvalidAttributeNameException(`Unknown Attribute ${Name}.`);
        }
    }
  }

  if (config.FifoQueue) {
    if (Attributes.ContentBasedDeduplication) {
      const ContentBasedDeduplication = parseBoolean(Attributes.ContentBasedDeduplication);
      if (typeof ContentBasedDeduplication == "boolean") {
        config.ContentBasedDeduplication = ContentBasedDeduplication;
      } else {
        throw new InvalidParameterValueException(`Valid values for ContentBasedDeduplication are 'true' | 'false'. Received ${Attributes.ContentBasedDeduplication}`);
      }
    }

    if (Attributes.DeduplicationScope) {
      if (DEDUPLICATION_TYPES.includes(Attributes.DeduplicationScope as (typeof DEDUPLICATION_TYPES)[number])) {
        config.DeduplicationScope = Attributes.DeduplicationScope as (typeof DEDUPLICATION_TYPES)[number];
      } else {
        throw new InvalidParameterValueException(`Valid values for DeduplicationScope are 'messageGroup' | 'queue'. Received ${Attributes.DeduplicationScope}`);
      }
    }

    if (Attributes.FifoThroughputLimit) {
      if (FIFO_THROUGHPUT_LIMIT_TYPE.includes(Attributes.FifoThroughputLimit as (typeof FIFO_THROUGHPUT_LIMIT_TYPE)[number])) {
        if (Attributes.FifoThroughputLimit == "perMessageGroupId") {
          if (config.DeduplicationScope == "messageGroup") {
            config.FifoThroughputLimit = "perMessageGroupId";
          } else {
            throw new InvalidParameterValueException("The perMessageGroupId value is allowed only when the value for DeduplicationScope is messageGroup");
          }
        } else {
          config.FifoThroughputLimit = "perQueue";
        }
      } else {
        throw new InvalidParameterValueException(`Valid values for FifoThroughputLimit are 'messageGroup' | 'queue'. Received ${Attributes.FifoThroughputLimit}`);
      }
    }
  } else if ("ContentBasedDeduplication" in Attributes) {
    throw new InvalidAttributeNameException("Unknown Attribute ContentBasedDeduplication. Should be used only with FIFO Queues.");
  } else if ("DeduplicationScope" in Attributes) {
    throw new InvalidAttributeNameException(
      isCreating ? "Unknown Attribute DeduplicationScope. Should be used only with FIFO Queues." : "You can specify the DeduplicationScope only when FifoQueue is set to true."
    );
  } else if ("FifoThroughputLimit" in Attributes) {
    throw new InvalidAttributeNameException(
      isCreating ? `Unknown Attribute FifoThroughputLimit. Should be used only with FIFO Queues.` : "You can specify the FifoThroughputLimit only when FifoQueue is set to true."
    );
  }

  if (config.RedrivePolicy && !(config.RedrivePolicy instanceof UnsetRedrivePolicy)) {
    const components = config.RedrivePolicy.deadLetterTargetArn.split(":");
    const [arn, partition, service, region, accountId, dlq] = components;

    if (service != "sqs") {
      throw new InvalidParameterValueException(
        `Value ${Attributes.RedrivePolicy} for parameter RedrivePolicy is invalid. Reason: Only SQS queues are valid resources for deadLetterTargetArn.`
      );
    }

    const isFifoDlq = dlq.endsWith(".fifo");

    if ((isFifoDlq && !config.FifoQueue) || (!isFifoDlq && config.FifoQueue)) {
      throw new InvalidAttributeNameException(
        `Value ${Attributes.RedrivePolicy} for parameter RedrivePolicy is invalid. Reason: Dead-letter queue must be same type of queue as the source..`
      );
    }

    if (sqsService.validateDlqDestination) {
      if (!sqsService.Queues.find((x) => x.QueueName == dlq)) {
        throw new InvalidParameterValueException(`Value ${Attributes.RedrivePolicy} for parameter RedrivePolicy is invalid. Reason: Dead letter target does not exist.`);
      }
    }
  }

  setKmsMasterKeyId(config, Attributes);

  const sqsManagedSseEnabledAsBool = parseBoolean(Attributes.SqsManagedSseEnabled) as boolean;

  if (typeof sqsManagedSseEnabledAsBool == "boolean" && sqsManagedSseEnabledAsBool && Attributes.KmsMasterKeyId) {
    throw new InvalidAttributeNameException("You can use one type of server-side encryption (SSE) at one time. You can either enable KMS SSE or SQS SSE.");
  }

  setKmsDataKeyReusePeriodSeconds(config, Attributes);
};
