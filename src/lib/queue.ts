import { randomUUID } from "crypto";
import {
  InvalidAttributeNameException,
  InvalidParameterValueException,
  OverLimitException,
  ReceiptHandleIsInvalidException,
  ResourceNotFoundException,
  SqsError,
} from "../common/errors";
import { md5, isJsObject } from "../common/utils";
import {
  VALID_POLICY_STATEMENT_EFFECT,
  VALID_POLICY_VERSIONS,
  MAX_MaxResults,
  kMaximumMessageSize,
  kMessageRetentionPeriod,
  kDelaySeconds,
  kReceiveMessageWaitTimeSeconds,
  kKmsDataKeyReusePeriodSeconds,
  REDRIVE_PERMISSIONS,
  DEDUPLICATION_TYPES,
  FIFO_THROUGHPUT_LIMIT_TYPE,
  UnsetPolicy,
  UnsetRedriveAllowPolicy,
  UnsetRedrivePolicy,
  MAX_POLICY_STATEMENT_LIMIT,
  kVisibilityTimeout,
  IN_FLIGHT_FIFO_QUEUE_LIMIT,
  IN_FLIGHT_STANDART_QUEUE_LIMIT,
} from "../common/constants";
import { MessageMoveTask, type IStartMessageMoveTask } from "./messageMoveTask";
import { md5OfMessageAttributes } from "aws-md5-of-message-attributes";

const SEQ_NUMBER_LENGTH = 20;

const MIN_SEQ_NUM = 1111111111111111;
const MAX_SEQ_NUM = 9999999999999999;
const TIME_FOR_SET_INTERVAL_TO_BE_EXECUTED = 40;

const randomSeq = () => String(Math.floor(Math.random() * (MAX_SEQ_NUM - MIN_SEQ_NUM + 1) + MIN_SEQ_NUM));
const randomSeqId = () => {
  const start = randomSeq().slice(0, 10);
  const end = randomSeq().slice(0, 10);

  return `${start}${end}`;
};

export interface IRedrivePolicy {
  deadLetterTargetArn: string;
  maxReceiveCount: number;
}

export interface IRedriveAllowPolicy {
  redrivePermission: (typeof REDRIVE_PERMISSIONS)[number];
  sourceQueueArns?: string[];
}

interface ListDLSQNextToken {
  nextStartPosition: number;
  QueueName: string;
  date: number;
}

export interface IQueueConfig {
  QueueName: string;
  ContentBasedDeduplication?: boolean;
  DeduplicationScope?: (typeof DEDUPLICATION_TYPES)[number];
  DelaySeconds?: number;
  FifoQueue?: boolean;
  FifoThroughputLimit?: (typeof FIFO_THROUGHPUT_LIMIT_TYPE)[number];
  KmsDataKeyReusePeriodSeconds?: number;
  KmsMasterKeyId?: string;
  MaximumMessageSize?: number;
  MessageRetentionPeriod?: number;
  ReceiveMessageWaitTimeSeconds?: number;
  VisibilityTimeout?: number;
  RedriveAllowPolicy?: IRedriveAllowPolicy;
  RedrivePolicy?: IRedrivePolicy;
  SqsManagedSseEnabled?: boolean;
  Tags: { [key: string]: string };
  Policy?: IPolicy;
}

type PolicyAction = `SQS:${string}`;
interface IPolicyStatement {
  Sid: string;
  Effect: (typeof VALID_POLICY_STATEMENT_EFFECT)[number];
  Principal: {
    AWS: `arn:aws:iam::${string}:root`;
  };
  Action: PolicyAction | PolicyAction[];
  Resource: `arn:aws:sqs:${string}:${string}:${string}`;
}

export interface IPolicy {
  Id?: string;
  Version: (typeof VALID_POLICY_VERSIONS)[number];
  Statement?: IPolicyStatement | IPolicyStatement[];
}

export class Queue implements IQueueConfig {
  static REGION = "us-east-1";
  static ACCOUNT_ID = "123456789012";
  static PORT = 0;
  static HOSTNAME = "localhost";
  static Queues: Queue[] = [];
  static BASE_URL: string = "/";
  static validateDlqDestination = true;
  static emulateLazyQueues = false;
  static emulateQueueCreationLifecycle = true;
  static deletingQueues: Set<string> = new Set();

  readonly QueueName: string;
  readonly FifoQueue: boolean = false;

  DelaySeconds: number = kDelaySeconds;
  FifoThroughputLimit?: "perQueue" | "perMessageGroupId" = "perQueue";
  ContentBasedDeduplication?: boolean = false;
  DeduplicationScope?: "messageGroup" | "queue" = "queue";
  KmsDataKeyReusePeriodSeconds?: number;
  KmsMasterKeyId?: string;
  MaximumMessageSize: number = kMaximumMessageSize;
  MessageRetentionPeriod: number = kMessageRetentionPeriod;
  ReceiveMessageWaitTimeSeconds: number = kReceiveMessageWaitTimeSeconds;
  VisibilityTimeout: number = kVisibilityTimeout;
  RedriveAllowPolicy?: IRedriveAllowPolicy;
  RedrivePolicy?: IRedrivePolicy;
  SqsManagedSseEnabled: boolean = true;
  CreatedTimestamp: number;
  LastModifiedTimestamp: number;
  Tags: { [key: string]: string } = {};
  Policy: IPolicy;

  #records: any[] = [];
  #delayed: number = 0;
  #deleted: number = 0;
  #messageGroups: Record<string, { seqId: string; count: number }> = {};
  #DLQName?: string;
  purgeInProgress: boolean = false;
  #MessageMoveTasks: MessageMoveTask[] = [];
  #IN_FLIGHT_LIMIT: number;
  get QueueUrl() {
    const port = Queue.PORT == 80 || Queue.PORT == 443 ? "" : `:${Queue.PORT}`;
    return `http://${Queue.HOSTNAME}${port}${Queue.BASE_URL}${Queue.ACCOUNT_ID}/${this.QueueName}`;
  }
  constructor({
    QueueName,
    ContentBasedDeduplication,
    DeduplicationScope,
    DelaySeconds,
    FifoQueue,
    FifoThroughputLimit,
    KmsDataKeyReusePeriodSeconds,
    KmsMasterKeyId,
    MaximumMessageSize,
    MessageRetentionPeriod,
    ReceiveMessageWaitTimeSeconds,
    VisibilityTimeout,
    RedriveAllowPolicy,
    RedrivePolicy,
    SqsManagedSseEnabled,
    Tags,
    Policy,
  }: IQueueConfig) {
    this.QueueName = QueueName;

    if (typeof SqsManagedSseEnabled == "boolean") {
      this.SqsManagedSseEnabled = SqsManagedSseEnabled;
    }

    if (KmsMasterKeyId) {
      this.SqsManagedSseEnabled = false;
      this.KmsMasterKeyId = KmsMasterKeyId;

      if (KmsDataKeyReusePeriodSeconds) {
        this.KmsDataKeyReusePeriodSeconds = KmsDataKeyReusePeriodSeconds;
      } else {
        this.KmsDataKeyReusePeriodSeconds = kKmsDataKeyReusePeriodSeconds;
      }
    }

    if (RedriveAllowPolicy) {
      this.RedriveAllowPolicy = RedriveAllowPolicy;
    }

    if (RedrivePolicy) {
      this.RedrivePolicy = RedrivePolicy;

      const comp = this.RedrivePolicy.deadLetterTargetArn.split(":");
      this.#DLQName = comp[comp.length - 1];
    }

    if (isJsObject(Tags)) {
      this.Tags = Tags;
    }

    if (DelaySeconds) {
      this.DelaySeconds = DelaySeconds;
    }

    if (MaximumMessageSize) {
      this.MaximumMessageSize = MaximumMessageSize;
    }

    if (MessageRetentionPeriod) {
      this.MessageRetentionPeriod = MessageRetentionPeriod;
    }
    if (ReceiveMessageWaitTimeSeconds) {
      this.ReceiveMessageWaitTimeSeconds = ReceiveMessageWaitTimeSeconds;
    }

    if (VisibilityTimeout) {
      this.VisibilityTimeout = VisibilityTimeout;
    }

    if (typeof FifoQueue == "boolean") {
      this.FifoQueue = FifoQueue;
    }

    if (this.FifoQueue) {
      this.#IN_FLIGHT_LIMIT = IN_FLIGHT_FIFO_QUEUE_LIMIT;
      if (DeduplicationScope) {
        this.DeduplicationScope = DeduplicationScope;
      }

      if (typeof ContentBasedDeduplication == "boolean") {
        this.ContentBasedDeduplication = ContentBasedDeduplication;
      }

      if (FifoThroughputLimit) {
        this.FifoThroughputLimit = FifoThroughputLimit;
      }
    } else {
      this.#IN_FLIGHT_LIMIT = IN_FLIGHT_STANDART_QUEUE_LIMIT;
    }

    if (Policy) {
      this.Policy = Policy;
    } else {
      this.Policy = {
        Id: `arn:aws:sqs:${Queue.REGION}:${Queue.ACCOUNT_ID}:${this.QueueName}/SQSDefaultPolicy`,
        Version: "2012-10-17",
      };
    }

    this.CreatedTimestamp = Date.now() / 1000;
    this.LastModifiedTimestamp = Date.now() / 1000;
  }
  setAttributes(Attributes: IQueueConfig) {
    const {
      ContentBasedDeduplication,
      DeduplicationScope,
      DelaySeconds,
      FifoThroughputLimit,
      KmsDataKeyReusePeriodSeconds,
      KmsMasterKeyId,
      MaximumMessageSize,
      MessageRetentionPeriod,
      ReceiveMessageWaitTimeSeconds,
      VisibilityTimeout,
      RedriveAllowPolicy,
      RedrivePolicy,
      SqsManagedSseEnabled,
      Policy,
    } = Attributes;

    if (typeof DelaySeconds == "number") {
      this.DelaySeconds = DelaySeconds;
    }

    if (typeof MaximumMessageSize == "number") {
      this.MaximumMessageSize = MaximumMessageSize;
    }

    if (typeof MessageRetentionPeriod == "number") {
      this.MessageRetentionPeriod = MessageRetentionPeriod;
    }
    if (typeof ReceiveMessageWaitTimeSeconds == "number") {
      this.ReceiveMessageWaitTimeSeconds = ReceiveMessageWaitTimeSeconds;
    }

    if (typeof VisibilityTimeout == "number") {
      this.VisibilityTimeout = VisibilityTimeout;
    }

    if (Policy) {
      if (Policy instanceof UnsetPolicy) {
        this.Policy.Statement = undefined;
      } else {
        this.Policy = Policy;
      }
    }

    if (RedriveAllowPolicy) {
      if (RedriveAllowPolicy instanceof UnsetRedriveAllowPolicy) {
        this.RedriveAllowPolicy = undefined;
      } else {
        this.RedriveAllowPolicy = RedriveAllowPolicy;
      }
    }

    if (RedrivePolicy) {
      if (RedrivePolicy instanceof UnsetRedrivePolicy) {
        this.RedrivePolicy = undefined;
        this.#DLQName = undefined;
      } else {
        this.RedrivePolicy = RedrivePolicy;
        const comp = this.RedrivePolicy.deadLetterTargetArn.split(":");
        this.#DLQName = comp[comp.length - 1];
      }
    }

    if (typeof SqsManagedSseEnabled == "boolean") {
      this.SqsManagedSseEnabled = SqsManagedSseEnabled;
    }

    if (SqsManagedSseEnabled) {
      this.KmsMasterKeyId = undefined;
      this.KmsDataKeyReusePeriodSeconds = undefined;
    }

    if (KmsMasterKeyId) {
      this.SqsManagedSseEnabled = false;
      this.KmsMasterKeyId = KmsMasterKeyId;
    }

    if (KmsDataKeyReusePeriodSeconds) {
      this.KmsDataKeyReusePeriodSeconds = KmsDataKeyReusePeriodSeconds;
    } else if (KmsMasterKeyId) {
      this.KmsDataKeyReusePeriodSeconds = kKmsDataKeyReusePeriodSeconds;
    }

    if (DeduplicationScope) {
      this.DeduplicationScope = DeduplicationScope;
    }

    if (typeof ContentBasedDeduplication == "boolean") {
      this.ContentBasedDeduplication = ContentBasedDeduplication;
    }

    if (FifoThroughputLimit) {
      this.FifoThroughputLimit = FifoThroughputLimit;
    }

    this.LastModifiedTimestamp = Date.now() / 1000;
  }
  #moveToDlq = (msg: any) => {
    const dlq = Queue.Queues.find((x) => x.QueueName == this.#DLQName);

    const { MessageId, MessageBody, attributes, MessageAttributes } = msg.record;

    let MessageDeduplicationId;

    if (typeof attributes.MessageDeduplicationId != "undefined") {
      MessageDeduplicationId = attributes.MessageDeduplicationId;
    }

    let MessageGroupId;

    if (typeof attributes.MessageGroupId != "undefined") {
      MessageGroupId = attributes.MessageGroupId;
    }

    const MessageSystemAttributes: Record<string, any> = {
      DeadLetterQueueSourceArn: { DataType: "String", StringValue: `arn:aws:sqs:${Queue.REGION}:${Queue.ACCOUNT_ID}:${this.QueueName}` },
    };

    if (attributes.AWSTraceHeader) {
      MessageSystemAttributes.AWSTraceHeader = { DataType: "String", StringValue: attributes.AWSTraceHeader };
    }

    const moveMsg = { MessageBody: MessageBody, MessageAttributes, MessageSystemAttributes, MessageDeduplicationId, MessageGroupId };

    this.#clearRecord(msg.record.MessageId);
    dlq?.setRecord(moveMsg, MessageId);
  };

  #clearRecord = (messageId: string) => {
    const foundIndex = this.#records.findIndex((x) => x.record.MessageId == messageId);
    if (foundIndex != -1) {
      clearTimeout(this.#records[foundIndex].tmRetention);
      clearTimeout(this.#records[foundIndex].tm);
      this.#records.splice(foundIndex, 1);
      this.#deleted++;
      return true;
    }
  };

  clearRecords() {
    for (const r of this.#records) {
      clearTimeout(r.tmRetention);
      clearTimeout(r.tm);
    }

    this.#records = [];
  }
  #toggleVisibility(x: any, customTimeout?: number, isChangeVisibilityAction?: boolean) {
    if (!x) {
      return;
    }

    let timeout = this.VisibilityTimeout * 1000;

    if (typeof customTimeout == "number" && !isNaN(customTimeout)) {
      timeout = customTimeout * 1000;
    }

    const ApproximateReceiveCount = Number(x.record.attributes.ApproximateReceiveCount) + 1;
    x.record.attributes.ApproximateReceiveCount = String(ApproximateReceiveCount);
    if (ApproximateReceiveCount == 1) {
      x.record.attributes.ApproximateFirstReceiveTimestamp = Date.now().toString();
    }

    x.visible = false;

    if (!isChangeVisibilityAction) {
      x.record.ReceiptHandle = this.#receiptHandle(x.record.MessageId);
    }

    if (x.tm) {
      clearTimeout(x.tm);
    }

    x.tm = setTimeout(() => {
      if (x) {
        if (this.RedrivePolicy && Number(x.record.attributes.ApproximateReceiveCount) >= this.RedrivePolicy.maxReceiveCount) {
          this.#moveToDlq(x);
        } else {
          x.visible = true;
        }
      }
    }, timeout);

    x.tmStart = Date.now();
  }
  #findDuplicatedMsg = (MessageGroupId: string, MessageDeduplicationId: string) => {
    if (this.DeduplicationScope == "queue") {
      return this.#records.find((x) => x.record.attributes.MessageDeduplicationId == MessageDeduplicationId);
    }

    return this.#records.find((x) => x.record.attributes.MessageGroupId == MessageGroupId && x.record.attributes.MessageDeduplicationId == MessageDeduplicationId);
  };
  #createSeqNumber(MessageGroupId: string) {
    if (this.#messageGroups[MessageGroupId]) {
      this.#messageGroups[MessageGroupId].count += 1;
    } else {
      this.#messageGroups[MessageGroupId] = { seqId: randomSeqId(), count: 1 };
    }

    const { seqId } = this.#messageGroups[MessageGroupId];
    const count = String(this.#messageGroups[MessageGroupId].count);

    return count.padStart(SEQ_NUMBER_LENGTH + 1 - count.length, seqId).slice(0, 20);
  }

  setRecord = (input: any, MessageId?: string) => {
    let SequenceNumber: string | undefined = undefined;
    let foundMsg: any = undefined;

    if (input.MessageGroupId) {
      foundMsg = this.#findDuplicatedMsg(input.MessageGroupId, input.MessageDeduplicationId);

      if (foundMsg) {
        SequenceNumber = foundMsg.record.attributes.SequenceNumber;
      } else {
        SequenceNumber = this.#createSeqNumber(input.MessageGroupId);
      }
    }

    const [msg, MD5OfMessageSystemAttributes] = Queue.createRecord({
      MessageId,
      MessageBody: input.MessageBody,
      MessageAttributes: input.MessageAttributes,
      MessageGroupId: input.MessageGroupId,
      MessageDeduplicationId: input.MessageDeduplicationId,
      MessageSystemAttributes: input.MessageSystemAttributes,
      SequenceNumber,
    });

    if (foundMsg) {
      msg.MessageId = foundMsg.record.MessageId;
      return { record: msg, MD5OfMessageSystemAttributes };
    }

    const record = this.newRecord(msg, Number(input.DelaySeconds));

    if (MD5OfMessageSystemAttributes) {
      record.MD5OfMessageSystemAttributes = MD5OfMessageSystemAttributes;
    }

    return record;
  };
  newRecord = (msg: Record<string, any>, delay?: number) => {
    const record: any = { visible: true, record: msg, delayed: true };

    const _delay = (isNaN(delay!) ? this.DelaySeconds : delay!) * 1000;

    this.#records.push(record);
    this.#delayed++;
    setTimeout(() => {
      record.delayed = false;

      this.#delayed--;
    }, _delay);

    record.tmRetention = setTimeout(() => {
      this.#clearRecord(record.record.MessageId);
    }, this.MessageRetentionPeriod * 1000);

    return record;
  };

  purge = (cb?: Function) => {
    if (this.purgeInProgress) {
      return false;
    } else {
      this.purgeInProgress = true;
      setTimeout(() => {
        this.clearRecords();
        cb?.();
        this.purgeInProgress = false;
      }, 60 * 1000);
      return true;
    }
  };

  async #collectedRecords(waitTime: number, maxMsgCount: number, VisibilityTimeout: number): Promise<any[]> {
    const collectedRecords: any = [];

    let timeout: NodeJS.Timeout;
    let resolveTimerPromise: Function;
    const resolveTimer = new Promise((resolve) => {
      resolveTimerPromise = resolve;
    });
    let i = 0;

    let interval: NodeJS.Timeout;

    timeout = setTimeout(() => {
      clearInterval(interval);
      resolveTimerPromise();
    }, TIME_FOR_SET_INTERVAL_TO_BE_EXECUTED + waitTime * 1000);

    interval = setInterval(() => {
      i++;

      for (const x of this.#records) {
        if (x.delayed) {
          continue;
        }

        if (x.visible) {
          this.#toggleVisibility(x, VisibilityTimeout);
          // shallow copy to keep track of receive count and other system attributes
          const recordCopy = { ...x };
          recordCopy.record = { ...recordCopy.record };
          recordCopy.record.attributes = { ...recordCopy.record.attributes };
          collectedRecords.push(recordCopy);
        }
        if (collectedRecords.length == maxMsgCount) {
          clearInterval(interval);
          clearTimeout(timeout);
          resolveTimerPromise();
          break;
        }
      }
    }, 10);

    await resolveTimer;

    return collectedRecords.map((x: any) => x.record);
  }
  async receive({ VisibilityTimeout, WaitTimeSeconds, MaxNumberOfMessages }: any) {
    const waitTime = WaitTimeSeconds ?? this.ReceiveMessageWaitTimeSeconds;
    const maxMsgCount = MaxNumberOfMessages ?? 1; // AWS SQS default value

    const ApproximateNumberOfMessages = this.#records.length;
    const ApproximateNumberOfMessagesNotVisible = this.#records.filter((x) => !x.visible).length;

    const inFlightMessages = ApproximateNumberOfMessages - ApproximateNumberOfMessagesNotVisible;

    if (maxMsgCount + inFlightMessages >= this.#IN_FLIGHT_LIMIT) {
      throw new OverLimitException("The maximum number of in flight messages is reached");
    }

    const collectedRecords = await this.#collectedRecords(waitTime, Number(maxMsgCount), Number(VisibilityTimeout));
    return collectedRecords;
  }
  #deleteMsg(foundMsgIndex: number) {
    clearTimeout(this.#records[foundMsgIndex].tmRetention);
    clearTimeout(this.#records[foundMsgIndex].tm);
    this.#records.splice(foundMsgIndex, 1);
    this.#deleted++;
  }
  delete(receiptHandle: string) {
    const { MessageId } = this.#decodeReceiptHandle(receiptHandle);

    const foundMsgIndex = this.#records.findIndex((x) => x.record.MessageId == MessageId);

    if (this.FifoQueue) {
      const foundMsg = this.#records[foundMsgIndex];
      if (!foundMsg) {
        return true;
      }

      if (foundMsg.visible || receiptHandle != foundMsg.record.ReceiptHandle) {
        throw new InvalidParameterValueException(`Value ${receiptHandle} for parameter ReceiptHandle is invalid. Reason: The receipt handle has expired.`);
      }
      this.#deleteMsg(foundMsgIndex);
    } else {
      if (foundMsgIndex != -1) {
        this.#deleteMsg(foundMsgIndex);
      }
    }

    return true;
  }
  changeVisibility(receiptHandle: string, VisibilityTimeout: string) {
    const { MessageId } = this.#decodeReceiptHandle(receiptHandle);

    const foundMsg = this.#records.find((x) => x.record.MessageId == MessageId);

    if (this.FifoQueue && (!foundMsg || foundMsg.visible || receiptHandle != foundMsg.record.ReceiptHandle)) {
      throw new InvalidParameterValueException(
        `Value ${receiptHandle} for parameter ReceiptHandle is invalid. Reason: Message does not exist or is not available for visibility timeout change.`
      );
    }

    if (!foundMsg) {
      return false;
    }

    let timeout = Number(VisibilityTimeout);

    this.#toggleVisibility(foundMsg, timeout, true);

    return true;
  }

  setTags(tags: { Key: string; Value: string }[]) {
    const hasInvalidValue = tags.find((x) => !x.Key || !x.Value || x.Value.startsWith("[object"));
    if (hasInvalidValue) {
      throw new InvalidParameterValueException("Tag values may only contain unicode letters, digits, whitespace, or one of these symbols: _ . : / = + - @'");
    }

    tags.forEach((x) => {
      this.Tags[x.Key] = x.Value;
    });
    this.LastModifiedTimestamp = Date.now() / 1000;
  }

  removeTags(tags: string[]) {
    tags.forEach((x) => {
      delete this.Tags[x];
    });
    this.LastModifiedTimestamp = Date.now() / 1000;
  }
  #findPolicyStatement(label: string) {
    if (Array.isArray(this.Policy.Statement)) {
      return this.Policy.Statement.find((x) => x.Sid == label);
    }

    if (this.Policy.Statement?.Sid == label) {
      return this.Policy.Statement;
    }
  }
  addPermission(Actions: string[], AWSAccountIds: string[], label: string) {
    let Action: IPolicyStatement["Action"] = [];

    const [AccountId] = AWSAccountIds;

    if (Actions.length == 1) {
      Action = `SQS:${Actions}`;
    } else {
      Action = Actions.map((x) => `SQS:${x}` as const);
    }

    const statement = {
      Sid: label,
      Effect: "Allow",
      Principal: {
        AWS: `arn:aws:iam::${AccountId}:root`,
      },
      Action,
      Resource: `arn:aws:sqs:${Queue.REGION}:${AccountId}:${this.QueueName}`,
    } as const;

    const foundStatement = this.#findPolicyStatement(label);

    if (foundStatement) {
      if (JSON.stringify(foundStatement) != JSON.stringify(statement)) {
        throw new InvalidParameterValueException(`Value ${label} for parameter Label is invalid. Reason: Already exists.`);
      }
      return;
    }

    if (Array.isArray(this.Policy.Statement)) {
      const newLength = this.Policy.Statement.length + 1;
      if (newLength > MAX_POLICY_STATEMENT_LIMIT) {
        throw new OverLimitException(`${newLength} Statements were found, maximum allowed is ${MAX_POLICY_STATEMENT_LIMIT}.`);
      }

      this.Policy.Statement.push(statement);
    } else if (this.Policy.Statement) {
      this.Policy.Statement = [this.Policy.Statement, statement];
    } else {
      this.Policy.Statement = statement;
    }

    this.LastModifiedTimestamp = Date.now() / 1000;
  }

  removePermission(label: string) {
    const err = new InvalidParameterValueException(`Value ${label} for parameter Label is invalid. Reason: can't find label on existing policy.`);

    if (Array.isArray(this.Policy.Statement)) {
      const foundIndex = this.Policy.Statement.findIndex((x) => x.Sid == label);
      if (foundIndex == -1) {
        throw err;
      }

      this.Policy.Statement.splice(2, 1);
    } else if (this.Policy.Statement) {
      if (this.Policy.Statement.Sid != label) {
        throw err;
      }

      delete this.Policy.Statement;
    } else {
      throw err;
    }

    this.LastModifiedTimestamp = Date.now() / 1000;
  }
  #getPolicy() {
    if (!this.Policy.Statement) {
      return;
    }

    if (Array.isArray(this.Policy.Statement) && !this.Policy.Statement.length) {
      return;
    }

    return JSON.stringify(this.Policy);
  }

  getAttributes(AttributeNames?: string[]) {
    if (!AttributeNames) {
      return;
    }

    if (!Array.isArray(AttributeNames)) {
      throw new InvalidParameterValueException("AttributeNames must be a list of string");
    }

    const attr: Record<string, string | undefined> = {
      QueueArn: `arn:aws:sqs:${Queue.REGION}:${Queue.ACCOUNT_ID}:${this.QueueName}`,
      ApproximateNumberOfMessages: String(this.#records.filter((x) => !x.delayed).length),
      ApproximateNumberOfMessagesNotVisible: String(this.#records.filter((x) => !x.visible).length),
      ApproximateNumberOfMessagesDelayed: String(this.#delayed),
      CreatedTimestamp: String(this.CreatedTimestamp).split(".")[0],
      LastModifiedTimestamp: String(this.LastModifiedTimestamp).split(".")[0],
      VisibilityTimeout: String(this.VisibilityTimeout),
      MaximumMessageSize: String(this.MaximumMessageSize),
      MessageRetentionPeriod: String(this.MessageRetentionPeriod),
      DelaySeconds: String(this.DelaySeconds),
      ReceiveMessageWaitTimeSeconds: String(this.ReceiveMessageWaitTimeSeconds),
      SqsManagedSseEnabled: String(this.SqsManagedSseEnabled),
    };

    const Policy = this.#getPolicy();

    if (Policy) {
      attr.Policy = Policy;
    }

    if (this.KmsMasterKeyId) {
      attr.KmsMasterKeyId = this.KmsMasterKeyId;
      attr.KmsDataKeyReusePeriodSeconds = String(typeof this.KmsDataKeyReusePeriodSeconds == "undefined" ? kKmsDataKeyReusePeriodSeconds : this.KmsDataKeyReusePeriodSeconds);
    }

    if (this.RedrivePolicy) {
      attr.RedrivePolicy = JSON.stringify(this.RedrivePolicy);
    }

    if (this.RedriveAllowPolicy) {
      attr.RedriveAllowPolicy = JSON.stringify(this.RedriveAllowPolicy);
    }

    if (this.FifoQueue) {
      attr.FifoQueue = "true";
      attr.DeduplicationScope = this.DeduplicationScope!;
      attr.FifoThroughputLimit = this.FifoThroughputLimit!;
      attr.ContentBasedDeduplication = String(this.ContentBasedDeduplication);
    }

    const attributeNames: any[] = [
      "QueueArn",
      "ApproximateNumberOfMessages",
      "ApproximateNumberOfMessagesNotVisible",
      "ApproximateNumberOfMessagesDelayed",
      "CreatedTimestamp",
      "LastModifiedTimestamp",
      "VisibilityTimeout",
      "MaximumMessageSize",
      "MessageRetentionPeriod",
      "DelaySeconds",
      "Policy",
      "ReceiveMessageWaitTimeSeconds",
      "SqsManagedSseEnabled",
      "KmsMasterKeyId",
      "KmsDataKeyReusePeriodSeconds",
      "RedrivePolicy",
      "RedriveAllowPolicy",
      "FifoQueue",
      "DeduplicationScope",
      "FifoThroughputLimit",
      "ContentBasedDeduplication",
    ];

    if (AttributeNames.includes("All")) {
      return attr;
    }

    let filteredAttribs: any = {};

    for (const x of AttributeNames) {
      if (!attributeNames.includes(x as any)) {
        throw new InvalidAttributeNameException(`Unknown Attribute ${x}`);
      }

      if (typeof attr[x] != "undefined") {
        filteredAttribs[x] = attr[x];
      }
    }

    if (Object.keys(filteredAttribs).length) {
      return filteredAttribs;
    }
  }

  listDeadLetterSourceQueues({ NextToken, MaxResults }: { NextToken?: string; MaxResults?: number }) {
    let startPosition = 0;
    const endPosition = isNaN(MaxResults!) ? MAX_MaxResults : MaxResults;

    if (NextToken) {
      try {
        const nextToken: ListDLSQNextToken = JSON.parse(Buffer.from(NextToken, "base64").toString("utf-8"));

        if (!nextToken.QueueName || !nextToken.date || !nextToken.nextStartPosition) {
          throw new InvalidParameterValueException("Invalid or expired next token.");
        }

        if (nextToken.QueueName != this.QueueName) {
          throw new InvalidParameterValueException("Invalid NextToken value. If you are passing in NextToken, you must not change the other request parameters.");
        }

        startPosition = nextToken.nextStartPosition;
      } catch (error) {
        if (error instanceof SqsError) {
          throw error;
        }
        throw new InvalidParameterValueException("Invalid or expired next token.");
      }
    }

    const result = Queue.Queues.filter((x) => x.RedrivePolicy?.deadLetterTargetArn.endsWith(`:${this.QueueName}`)).map((x) => x.QueueUrl);

    const total = result.length;

    const queueUrls = result.splice(startPosition, endPosition);
    const response: { NextToken?: string; queueUrls?: string[] } = {};

    if (queueUrls.length) {
      if (startPosition + queueUrls.length < total) {
        response.NextToken = Buffer.from(JSON.stringify({ QueueName: this.QueueName, nextStartPosition: startPosition + queueUrls.length, date: Date.now() })).toString("base64");
      }
      response.queueUrls = queueUrls;
    }

    return response;
  }

  startMessageMoveTask(params: IStartMessageMoveTask) {
    if (this.#MessageMoveTasks.find((x) => x.Status == "RUNNING")) {
      throw new InvalidParameterValueException("There is already a task running. Only one active task is allowed for a source queue arn at a given time.");
    }

    const task = new MessageMoveTask(params, this);
    this.#MessageMoveTasks.unshift(task);

    if (this.#MessageMoveTasks.length > 10) {
      this.#MessageMoveTasks.pop();
    }
    return task.TaskHandle;
  }

  listMessageMoveTasks(MaxResults: number) {
    return this.#MessageMoveTasks.slice(0, MaxResults).map((x) => x.getState());
  }
  cancelMessageMoveTask(taskId: string) {
    const task = this.#MessageMoveTasks.find((x) => x.taskId == taskId);

    if (!task) {
      throw new ResourceNotFoundException("Task does not exist.");
    }

    return task.cancel();
  }

  static resetAll() {
    for (const q of this.Queues) {
      q.clearRecords();
    }
    this.Queues = [];
    this.deletingQueues.clear();
  }
  static listQueues = ({ prefix, limit, token }: { prefix?: string; limit?: number; token?: string }) => {
    let previousStartPosition = 0;
    if (token) {
      if (!limit) {
        throw new InvalidParameterValueException("MaxResults is a mandatory parameter when you provide a value for NextToken.");
      }

      try {
        const parsedToken = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        previousStartPosition = parsedToken.previousStartPosition;

        if (parsedToken.previousPrefix && (parsedToken.previousPrefix != prefix || !prefix)) {
          throw new InvalidParameterValueException("Invalid NextToken value. If you are passing in NextToken, you must not change the other request parameters.");
        }
      } catch (error) {
        if (error instanceof SqsError) {
          throw error;
        } else {
          throw new InvalidParameterValueException("Invalid NextToken value.");
        }
      }
    }

    let list = typeof prefix == "string" ? Queue.Queues.filter((x) => x.QueueName.startsWith(prefix)) : Queue.Queues;

    let nextToken: any;
    if (limit) {
      if (limit > 1000 || limit < 1) {
        throw new InvalidParameterValueException("Value for parameter MaxResults is invalid. Reason: MaxResults must be an integer between 1 and 1000.");
      }

      const listLength = list.length;
      list = list.slice().splice(previousStartPosition, limit);

      if (previousStartPosition + limit < listLength) {
        nextToken = {
          previousStartPosition: previousStartPosition + limit,
          previousPrefix: prefix,
          date: Date.now(),
        };
      }
    }

    if (list.length > 1000) {
      list = list.slice().splice(0, 1000);

      if (nextToken) {
        nextToken.previousStartPosition = nextToken.previousStartPosition - limit! + 1000;
      } else {
        nextToken = {
          previousStartPosition: previousStartPosition + 1000,
          previousPrefix: prefix,
          date: Date.now(),
        };
      }
    }

    if (nextToken) {
      nextToken = Buffer.from(JSON.stringify(nextToken)).toString("base64");
    }
    return {
      list: list.map((x) => x.QueueUrl),
      nextToken,
    };
  };
  #receiptHandle(MessageId: string) {
    return Buffer.from(randomUUID() + JSON.stringify({ date: Date.now(), MessageId, QueueName: this.QueueName }), "utf-8").toString("base64");
  }
  #decodeReceiptHandle(rawReceiptHandle: string) {
    try {
      const receiptHandle = Buffer.from(rawReceiptHandle, "base64").toString("utf-8");
      const decoded = JSON.parse(receiptHandle.slice(receiptHandle.indexOf("{")));
      if (!decoded.date || !decoded.MessageId || !decoded.QueueName || decoded.QueueName != this.QueueName) {
        throw new Error();
      }
      return decoded;
    } catch (error) {
      throw new ReceiptHandleIsInvalidException(rawReceiptHandle);
    }
  }
  static createRecord({
    MessageBody,
    MessageAttributes,
    MessageSystemAttributes,
    MessageGroupId,
    MessageDeduplicationId,
    SequenceNumber,
    MessageId,
  }: any): [Record<string, any>, string | undefined] {
    const record: Record<string, any> = {
      MessageId: MessageId ?? randomUUID(),
      ReceiptHandle: "",
      MessageBody,
      attributes: {
        ApproximateReceiveCount: "0",
        SentTimestamp: Date.now().toString(),
        SenderId: "ABCDEFGHI1JKLMNOPQ23R",
        ApproximateFirstReceiveTimestamp: "",
      },
      MessageAttributes,
      MD5OfMessageBody: md5(MessageBody),
    };

    if (MessageGroupId) {
      record.attributes.MessageGroupId = MessageGroupId;
      record.attributes.MessageDeduplicationId = MessageDeduplicationId;
      record.attributes.SequenceNumber = SequenceNumber;
    }

    if (MessageAttributes) {
      record.MD5OfMessageAttributes = md5OfMessageAttributes(MessageAttributes);
    }

    let MD5OfMessageSystemAttributes;
    if (MessageSystemAttributes) {
      MD5OfMessageSystemAttributes = md5OfMessageAttributes(MessageSystemAttributes);
      for (const [k, v] of Object.entries(MessageSystemAttributes)) {
        const { DataType, BinaryValue, StringValue } = v as any;
        record.attributes[k] = DataType.startsWith("B") ? BinaryValue : StringValue;
      }
    }

    return [record, MD5OfMessageSystemAttributes];
  }
}
