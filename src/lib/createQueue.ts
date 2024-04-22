import { FIFO_QUEUE_NAME_PATTERN, QUEUE_NAME_PATTERN, TAG_KEY_PATTERN, TAG_KEY_ERR_MSG, attributeNames } from "../common/constants";
import { InvalidParameterValueException, QueueDeletedRecentlyException, QueueNameExistsException } from "../common/errors";
import { Queue, type IQueueConfig } from "./queue";
import { setAttributes } from "./setAttributes";

interface IAmzQueryBody {
  QueueName: string;
  Attribute?: { Name: (typeof attributeNames)[number]; Value: string }[];
  Tag?: { Key: string; Value: string }[];
}

const parseJsonBody = (body: any) => {
  const { QueueName, Attributes, tags } = body;

  const config: IQueueConfig = {
    QueueName: "",
    Tags: {},
  };

  if (typeof QueueName == "undefined") {
    throw new InvalidParameterValueException("Value for parameter QueueName is invalid. Reason: Must specify a queue name.");
  }

  if (!QueueName) {
    throw new InvalidParameterValueException("Queue name cannot be empty");
  }

  config.QueueName = QueueName;

  if (Attributes) {
    setAttributes(config, Attributes);
  }

  if (tags) {
    if (Object.keys(tags).some((x) => !TAG_KEY_PATTERN.test(x))) {
      throw new InvalidParameterValueException(TAG_KEY_ERR_MSG);
    }
    config.Tags = tags;
  }

  return config;
};

const parseAmzQueryBody = (body: any) => {
  const { QueueName, Attribute, Tag } = body as IAmzQueryBody;

  const config: IQueueConfig = {
    QueueName: "",
    Tags: {},
  };

  if (typeof QueueName == "undefined") {
    throw new InvalidParameterValueException("Value for parameter QueueName is invalid. Reason: Must specify a queue name.");
  }

  if (!QueueName) {
    throw new InvalidParameterValueException("Queue name cannot be empty");
  }

  config.QueueName = QueueName;

  if (Array.isArray(Attribute)) {
    const Attributes: Record<string, string> = {};
    for (const { Name, Value } of Attribute) {
      Attributes[Name] = Value;
    }
    setAttributes(config, Attributes);
  }

  if (Array.isArray(Tag)) {
    for (const { Key, Value } of Tag) {
      if (!TAG_KEY_PATTERN.test(Key)) {
        throw new InvalidParameterValueException(TAG_KEY_ERR_MSG);
      }

      config.Tags[Key] = Value;
    }
  }

  return config;
};

const parseCreateQueueBody = (body: any, isJsonProtocol: boolean) => {
  if (isJsonProtocol) {
    return parseJsonBody(body);
  }
  return parseAmzQueryBody(body);
};

const compareQueueAttributes = (oldQueue: Queue, newQueue: Queue) => {
  if (oldQueue.DelaySeconds != newQueue.DelaySeconds) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute DelaySeconds");
  }

  if (oldQueue.MaximumMessageSize != newQueue.MaximumMessageSize) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute MaximumMessageSize");
  }

  if (oldQueue.MessageRetentionPeriod != newQueue.MessageRetentionPeriod) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute MessageRetentionPeriod");
  }

  if (oldQueue.ReceiveMessageWaitTimeSeconds != newQueue.ReceiveMessageWaitTimeSeconds) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute ReceiveMessageWaitTimeSeconds");
  }

  if (oldQueue.VisibilityTimeout != newQueue.VisibilityTimeout) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute VisibilityTimeout");
  }

  if (JSON.stringify(oldQueue.RedrivePolicy) != JSON.stringify(newQueue.RedrivePolicy)) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute RedrivePolicy");
  }

  if (JSON.stringify(oldQueue.RedriveAllowPolicy) != JSON.stringify(newQueue.RedriveAllowPolicy)) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute RedriveAllowPolicy");
  }

  if (oldQueue.DeduplicationScope != newQueue.DeduplicationScope) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute DeduplicationScope");
  }
  if (oldQueue.FifoThroughputLimit != newQueue.FifoThroughputLimit) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute FifoThroughputLimit");
  }

  if (JSON.stringify(oldQueue.Tags) != JSON.stringify(newQueue.Tags)) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for tags");
  }

  if (oldQueue.KmsMasterKeyId != newQueue.KmsMasterKeyId) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute KmsMasterKeyId");
  }

  if (oldQueue.KmsDataKeyReusePeriodSeconds != newQueue.KmsDataKeyReusePeriodSeconds) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute KmsDataKeyReusePeriodSeconds");
  }

  if (oldQueue.SqsManagedSseEnabled != newQueue.SqsManagedSseEnabled) {
    throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute SqsManagedSseEnabled");
  }

  if (newQueue.Policy) {
    if (JSON.stringify(newQueue.Policy) != JSON.stringify(oldQueue.Policy)) {
      throw new QueueNameExistsException("A queue already exists with the same name and a different value for attribute Policy");
    }
  }
};

export const createQueue = (body: any, isJsonProtocol: boolean) => {
  const queueConfig = parseCreateQueueBody(body, isJsonProtocol);

  const queue = new Queue(queueConfig);

  if (!queue.FifoQueue && !QUEUE_NAME_PATTERN.test(queue.QueueName)) {
    throw new InvalidParameterValueException("Can only include alphanumeric characters, hyphens, or underscores. 1 to 80 in length");
  }

  if (queue.FifoQueue && !FIFO_QUEUE_NAME_PATTERN.test(queue.QueueName)) {
    throw new InvalidParameterValueException(
      "The name of a FIFO queue can only include alphanumeric characters, hyphens, or underscores, must end with .fifo suffix and be 1 to 80 in length."
    );
  }

  if (Queue.deletingQueues.has(queue.QueueName)) {
    throw QueueDeletedRecentlyException;
  }

  const foundQueue = Queue.Queues.find((x) => x.QueueName == queue.QueueName);
  if (foundQueue) {
    compareQueueAttributes(foundQueue, queue);
    return foundQueue.QueueUrl;
  }

  if (Queue.emulateLazyQueues) {
    setTimeout(() => {
      Queue.Queues.push(queue);
    }, 1150);
  } else {
    Queue.Queues.push(queue);
  }

  return queue.QueueUrl;
};
