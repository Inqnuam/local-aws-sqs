import type { BinaryLike } from "crypto";
import { createHash } from "crypto";
import {
  InvalidBatchEntryId,
  InvalidDelaySeconds,
  InvalidMaxNumberOfMessages,
  InvalidMaximumMessageSize,
  InvalidMessageRetentionPeriod,
  InvalidReceiveMessageWaitTimeSeconds,
  InvalidVisibilityTimeout,
  MalformedInputException,
  OverLimitException,
} from "./errors";
import {
  AWS_PARTITIONS,
  MAX_MessageRetentionPeriod,
  MAX_POLICY_STATEMENT_LIMIT,
  MAX_ReceiveMessageWaitTimeSeconds,
  MAX_VisibilityTimeout,
  MAX_sourceQueueArns,
  MIN_MessageRetentionPeriod,
  MIN_ReceiveMessageWaitTimeSeconds,
  MIN_VisibilityTimeout,
  REDRIVE_PERMISSIONS,
  VALID_POLICY_FIELDS,
  VALID_POLICY_STATEMENT_EFFECT,
  VALID_POLICY_STATEMENT_FIELDS,
  VALID_POLICY_VERSIONS,
  VALID_REDRIVE_ALLOW_POLICY_FIELDS,
} from "./constants";

export const md5 = (contents: string | BinaryLike): string => {
  return createHash("md5").update(contents).digest("hex");
};

export const sha256 = (content: string | BinaryLike) => {
  return createHash("sha256").update(content).digest("hex");
};

export const findDuplicatedIds = (entries: any[]) => {
  const ids = entries.map((x) => {
    const entry = {
      id: x.Id,
      total: entries.filter((e) => e.Id == x.Id).length,
    };
    return entry;
  });

  return ids.find((x) => x.total > 1)?.id;
};

const alphaNumAndHyphens = /(-|\w+)/g;
const isValidMessageId = (id: string) => {
  return typeof id == "string" && id.trim().length && id.length < 81 && id.replace(alphaNumAndHyphens, "") == "";
};

export const validateBatchEntryId = (entry: any, i: number, cmd: "DeleteMessageBatchRequestEntry" | "SendMessageBatchRequestEntry" | "ChangeMessageVisibilityBatch") => {
  if (typeof entry.Id == "number" || typeof entry.Id == "boolean") {
    entry.Id = String(entry.Id);
  }

  if (!isValidMessageId(entry.Id)) {
    throw InvalidBatchEntryId;
  }
};

const INVALID_POLICY_VALUE = "Invalid value for the parameter Policy.";

const invalidStatementErr = new Error("Invalid Statement");

const redriveAllowPolicyErrMsg = "Invalid value for the parameter RedriveAllowPolicy. Reason: Amazon SQS can't create the redrive allow policy, as it’s in an unsupported format.";

const verifyPolicyStatement = (x: any) => {
  if (!isJsObject(x)) {
    throw invalidStatementErr;
  }

  const keys: any[] = Object.keys(x);

  if (keys.some((x) => !VALID_POLICY_STATEMENT_FIELDS.includes(x))) {
    throw invalidStatementErr;
  }

  if (!VALID_POLICY_STATEMENT_EFFECT.includes(x.Effect)) {
    throw invalidStatementErr;
  }

  if (typeof x.Action != "string" && !Array.isArray(x.Action)) {
    throw invalidStatementErr;
  }

  if (typeof x.Resource != "string" && !Array.isArray(x.Resource)) {
    throw invalidStatementErr;
  }
};

const isValidQueueArn = (rawArn: string) => {
  const components = rawArn.split(":");

  if (components.length != 6) {
    return false;
  }

  const [arn, partition] = components;

  if (arn != "arn") {
    return false;
  }

  if (!AWS_PARTITIONS.includes(partition)) {
    return false;
  }

  return true;
};
export const verifyQueueAttribValue = {
  DelaySeconds: (x: any) => {
    if (x === null) {
      return;
    }

    if (isJsObject(x)) {
      return new MalformedInputException("Start of structure or map found where not expected.");
    }

    if (Array.isArray(x)) {
      return new MalformedInputException("Unrecognized collection type class java.lang.String");
    }

    if (typeof x == "string") {
      if (x == "" || x.includes(" ") || x.includes(".")) {
        return InvalidDelaySeconds;
      }
    }

    if (isNaN(x) || Number(x) < 0 || Number(x) > 900) {
      return InvalidDelaySeconds;
    }
  },
  MessageRetentionPeriod: (x: any) => {
    if (x === null) {
      return;
    }

    if (isJsObject(x)) {
      return new MalformedInputException("Start of structure or map found where not expected.");
    }

    if (Array.isArray(x)) {
      return new MalformedInputException("Unrecognized collection type class java.lang.String");
    }

    if (typeof x == "string") {
      if (x == "" || x.includes(" ") || x.includes(".")) {
        return InvalidMessageRetentionPeriod;
      }
    }

    if (isNaN(x)) {
      return InvalidMessageRetentionPeriod;
    }

    if (Number(x) < MIN_MessageRetentionPeriod || Number(x) > MAX_MessageRetentionPeriod) {
      return InvalidMessageRetentionPeriod;
    }
  },
  ReceiveMessageWaitTimeSeconds: (x: any) => {
    if (x === null) {
      return;
    }

    if (isJsObject(x)) {
      return new MalformedInputException("Start of structure or map found where not expected.");
    }

    if (Array.isArray(x)) {
      return new MalformedInputException("Unrecognized collection type class java.lang.String");
    }

    if (typeof x == "string") {
      if (x == "" || x.includes(" ") || x.includes(".")) {
        return InvalidReceiveMessageWaitTimeSeconds;
      }
    }

    if (isNaN(x) || Number(x) < MIN_ReceiveMessageWaitTimeSeconds || Number(x) > MAX_ReceiveMessageWaitTimeSeconds) {
      return InvalidReceiveMessageWaitTimeSeconds;
    }
  },
  VisibilityTimeout: (x: any) => {
    if (x === null) {
      return;
    }

    if (isJsObject(x)) {
      return new MalformedInputException("Start of structure or map found where not expected.");
    }

    if (Array.isArray(x)) {
      return new MalformedInputException("Unrecognized collection type class java.lang.String");
    }

    if (typeof x == "string") {
      if (x == "" || x.includes(" ") || x.includes(".")) {
        return InvalidVisibilityTimeout;
      }
    }

    if (isNaN(x) || Number(x) < MIN_VisibilityTimeout || Number(x) > MAX_VisibilityTimeout) {
      return InvalidVisibilityTimeout;
    }
  },
  MaximumMessageSize: (x: any) => {
    if (x === null) {
      return;
    }

    if (isJsObject(x)) {
      return new MalformedInputException("Start of structure or map found where not expected.");
    }

    if (Array.isArray(x)) {
      return new MalformedInputException("Unrecognized collection type class java.lang.String");
    }

    if (typeof x == "string") {
      if (x == "" || x.includes(" ") || x.includes(".")) {
        return InvalidMaximumMessageSize;
      }
    }

    if (isNaN(x) || Number(x) < 1024 || Number(x) > 262144) {
      return InvalidMaximumMessageSize;
    }
  },
  Policy: (x?: any) => {
    if (!x) {
      return;
    }

    let policy = undefined;

    try {
      policy = JSON.parse(x);

      if (!isJsObject(policy)) {
        return INVALID_POLICY_VALUE;
      }
    } catch (error) {
      return INVALID_POLICY_VALUE;
    }

    const keys: any[] = Object.keys(policy);

    if (keys.some((k) => !VALID_POLICY_FIELDS.includes(k))) {
      return INVALID_POLICY_VALUE;
    }

    if (!VALID_POLICY_VERSIONS.includes(policy.Version)) {
      return INVALID_POLICY_VALUE;
    }

    if (isJsObject(policy.Statement)) {
      try {
        verifyPolicyStatement(policy.Statement);
      } catch (error) {
        return INVALID_POLICY_VALUE;
      }
    } else {
      if (!Array.isArray(policy.Statement) || !policy.Statement.length) {
        return INVALID_POLICY_VALUE;
      }

      if (policy.Statement.length > MAX_POLICY_STATEMENT_LIMIT) {
        return new OverLimitException(`${policy.Statement.length} statements were found in the submitted policy, max allowed is ${MAX_POLICY_STATEMENT_LIMIT}`);
      }

      for (const statement of policy.Statement) {
        try {
          verifyPolicyStatement(statement);
        } catch (error) {
          return INVALID_POLICY_VALUE;
        }
      }
    }
  },

  RedrivePolicy: (x?: any) => {
    if (typeof x == "number" || x === true || Array.isArray(x)) {
      return "Invalid value for the parameter RedrivePolicy. Reason: Redrive policy is not a valid JSON map.";
    }

    // in RedrivePolicy validation empty string and null are considered as undefined
    if (!x) {
      return;
    }

    try {
      const parsedPolicy = JSON.parse(x);

      if (!("maxReceiveCount" in parsedPolicy)) {
        return `Value ${x} for parameter RedrivePolicy is invalid. Reason: Redrive policy does not contain mandatory attribute: maxReceiveCount.`;
      }

      if (!("deadLetterTargetArn" in parsedPolicy)) {
        return `Value ${x} for parameter RedrivePolicy is invalid. Reason: Redrive policy does not contain mandatory attribute: deadLetterTargetArn.`;
      }

      const maxReceiveCount = Number(parsedPolicy.maxReceiveCount);

      if (maxReceiveCount < 1 || maxReceiveCount > 1000) {
        return `Value ${x} for parameter RedrivePolicy is invalid. Reason: Invalid value for maxReceiveCount: ${parsedPolicy.maxReceiveCount}, valid values are from 1 to 1000 both inclusive.`;
      }

      if (!isValidQueueArn(parsedPolicy.deadLetterTargetArn)) {
        return `Value ${x} for parameter RedrivePolicy is invalid. Reason: Dead-letter target ARN should be fully qualified ARN.`;
      }

      if (Object.keys(parsedPolicy).length > 2) {
        return `Value ${x} for parameter RedrivePolicy is invalid. Reason: Only following attributes are supported: [maxReceiveCount, deadLetterTargetArn].`;
      }
    } catch (error) {
      return "Invalid value for the parameter RedrivePolicy. Reason: Redrive policy is not a valid JSON map.";
    }
  },

  RedriveAllowPolicy: (x?: any) => {
    const inputType = typeof x;

    if (inputType == "number" || inputType == "boolean") {
      return redriveAllowPolicyErrMsg;
    }

    // undefined, null and empty string are bypassed
    if (!x) {
      return;
    }

    let policy;
    try {
      policy = JSON.parse(x);
      if (!isJsObject(policy)) {
        return redriveAllowPolicyErrMsg;
      }
    } catch (error) {
      return redriveAllowPolicyErrMsg;
    }

    if (!REDRIVE_PERMISSIONS.includes(policy.redrivePermission)) {
      return redriveAllowPolicyErrMsg;
    }

    const keys = Object.keys(policy);

    if (keys.find((x: any) => !VALID_REDRIVE_ALLOW_POLICY_FIELDS.includes(x))) {
      return redriveAllowPolicyErrMsg;
    }

    if (policy.sourceQueueArns) {
      if (!Array.isArray(policy.sourceQueueArns)) {
        return redriveAllowPolicyErrMsg;
      }

      if (policy.sourceQueueArns.find((x: any) => typeof x != "string")) {
        return redriveAllowPolicyErrMsg;
      }

      if (policy.redrivePermission != "byQueue") {
        return `Value ${x} for parameter RedriveAllowPolicy is invalid. Reason: Amazon SQS can't create the redrive allow policy. To specify one or more source queue ARNs, you must set redrivePermission to byQueue.`;
      } else {
        if (!policy.sourceQueueArns.length) {
          return `Value ${x} for parameter RedriveAllowPolicy is invalid. Reason: Amazon SQS can't create the redrive allow policy. When you specify the byQueue permission type, you must also specify one or more sourceQueueArns values.`;
        }
        if (policy.sourceQueueArns.length > MAX_sourceQueueArns) {
          return `Value ${x} for parameter RedriveAllowPolicy is invalid. Reason: Amazon SQS can't create the redrive allow policy. The maximum number of source queue ARNs you can specify is 10.`;
        }
      }
    }

    if (policy.redrivePermission == "byQueue" && !policy.sourceQueueArns) {
      return `Value ${x} for parameter RedriveAllowPolicy is invalid. Reason: Amazon SQS can't create the redrive allow policy. When you specify the byQueue permission type, you must also specify one or more sourceQueueArns values.`;
    }
  },

  SqsManagedSseEnabled: (x: any) => {
    if (x === null || typeof x == "boolean" || (typeof x == "string" && (x == "true" || x == "false"))) {
      return;
    }

    return "Invalid value for the parameter SqsManagedSseEnabled.";
  },
  MaxNumberOfMessages: (x: any) => {
    if (x === null) {
      return;
    }

    if (isJsObject(x)) {
      return new MalformedInputException("Start of structure or map found where not expected.");
    }

    if (Array.isArray(x)) {
      return new MalformedInputException("Start of list found where not expected");
    }

    if (typeof x == "string") {
      if (x == "" || x.includes(" ") || x.includes(".")) {
        return new InvalidMaxNumberOfMessages(x);
      }
    }

    if (isNaN(x) || Number(x) < 1 || Number(x) > 10) {
      return new InvalidMaxNumberOfMessages(x);
    }
  },
} as const;

export const isJsObject = (value: any) => Object.prototype.toString.call(value) == "[object Object]";

export const getQueueNameFromArn = (arn: string) => {
  const sourceArnComponents = (arn as string).split(":");
  return sourceArnComponents[sourceArnComponents.length - 1];
};
