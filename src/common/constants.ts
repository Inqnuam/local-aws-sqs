import type { IPolicy, IRedriveAllowPolicy, IRedrivePolicy } from "../lib/queue";

export const AWS_JSON_TYPE = "application/x-amz-json-1.0";
export const AWS_XML_TYPE = "text/xml";
export const AWS_ACTION_TYPE = "x-amz-target";
export const AWS_TRACE_ID = "x-amzn-trace-id";
export const ENV_TRACE_ID = "_X_AMZN_TRACE_ID";
export const AWS_PARTITIONS = ["aws", "aws-cn", "aws-us-gov"];
export const AWS_REGION_ENV = "AWS_REGION";
export const AWS_DEFAULT_REGION_ENV = "AWS_DEFAULT_REGION";

export const TAG_KEY_PATTERN = /^[\p{L}\p{N}\s_.:/=+\-@]*$/u;
export const FIFO_QUEUE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,80}\.fifo$/;
export const QUEUE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
export const ALPHANUM_PUNCT_PATTERN = /^[a-zA-Z0-9!"#$%&''()*+,\-.\/:;<=>?@[\\\]^_`{|}~]{1,128}$/;
export const TAG_KEY_ERR_MSG = "Tag keys may only contain unicode letters, digits, whitespace, or one of these symbols: _ . : / = + - @";

export const VALID_POLICY_VERSIONS = ["2012-10-17", "2008-10-17"] as const;
export const VALID_POLICY_FIELDS = ["Version", "Id", "Statement"] as const;
export const VALID_POLICY_STATEMENT_FIELDS = ["Sid", "Effect", "Principal", "Action", "Resource", "Condition"] as const;
export const VALID_POLICY_STATEMENT_EFFECT = ["Allow", "Deny"] as const;

export const VALID_REDRIVE_ALLOW_POLICY_FIELDS = ["redrivePermission", "sourceQueueArns"] as const;

export const FORBIDDEN_POLICY_ACTIONS = [
  "AddPermission",
  "CancelMessageMoveTask",
  "CreateQueue",
  "RemovePermission",
  "DeleteQueue",
  "ListMessageMoveTasks",
  "ListQueues",
  "ListQueueTags",
  "StartMessageMoveTask",
  "TagQueue",
  "UntagQueue",
];

export const VALID_POLICY_ACTIONS = [
  "*",
  "ChangeMessageVisibility",
  "DeleteMessage",
  "ListDeadLetterSourceQueues",
  "GetQueueAttributes",
  "GetQueueUrl",
  "PurgeQueue",
  "ReceiveMessage",
  "SendMessage",
];

export const VALIDE_DATA_TYPES = /^(String|Number|Binary)(\..*)?$/;
export const VALIDE_SYSTEM_ATTRIBUTES = ["AWSTraceHeader"];

export const MAX_MESSAGE_ATTRIBUTES_KEYS = 10;
export const MAX_MESSAGE_ATTRIBUTE_NAME_LENGTH = 256;
export const MAX_MESSAGE_ATTRIBUTE_TYPE_LENGTH = 256;

export const MIN_MaxResults = 1;
export const MAX_MaxResults = 1000;

export const MIN_KmsDataKeyReusePeriodSeconds = 60;
export const kKmsDataKeyReusePeriodSeconds = 300;
export const MAX_KmsDataKeyReusePeriodSeconds = 86400;

export const MAX_sourceQueueArns = 10;

export const kMaximumMessageSize = 1048576;

export const MIN_MessageRetentionPeriod = 60;
export const kMessageRetentionPeriod = 345600;
export const MAX_MessageRetentionPeriod = 1209600;

export const MIN_VisibilityTimeout = 0;
export const kVisibilityTimeout = 30;
export const MAX_VisibilityTimeout = 43200;

export const kDelaySeconds = 0;

export const MIN_ReceiveMessageWaitTimeSeconds = 0;
export const kReceiveMessageWaitTimeSeconds = 0;
export const MAX_ReceiveMessageWaitTimeSeconds = 20;

export const MAX_POLICY_STATEMENT_LIMIT = 20;

export const MIN_MaxNumberOfMessagesPerSecond = 1;
export const MAX_MaxNumberOfMessagesPerSecond = 500;

export const IN_FLIGHT_FIFO_QUEUE_LIMIT = 20000;
export const IN_FLIGHT_STANDART_QUEUE_LIMIT = 120000;

export const attributeNames = [
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
  "FifoQueue",
  "ContentBasedDeduplication",
  "DeduplicationScope",
  "FifoThroughputLimit",
] as const;

export const REDRIVE_PERMISSIONS = ["allowAll", "denyAll", "byQueue"] as const;
export const DEDUPLICATION_TYPES = ["messageGroup", "queue"] as const;
export const FIFO_THROUGHPUT_LIMIT_TYPE = ["perQueue", "perMessageGroupId"] as const;

export class UnsetPolicy implements IPolicy {
  Version = "2012-10-17" as const;
}

export class UnsetRedrivePolicy implements IRedrivePolicy {
  maxReceiveCount = 0;
  deadLetterTargetArn = "";
}
export class UnsetRedriveAllowPolicy implements IRedriveAllowPolicy {
  redrivePermission = "allowAll" as const;
}
