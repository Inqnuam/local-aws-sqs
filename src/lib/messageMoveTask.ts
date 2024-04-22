import { randomUUID } from "crypto";
import { Queue } from "./queue";
import { InvalidParameterValueException } from "../common/errors";
import { getQueueNameFromArn } from "../common/utils";

export interface IStartMessageMoveTask {
  SourceArn: string;
  DestinationArn?: string;
  MaxNumberOfMessagesPerSecond?: number;
}

const MAX_EmptyMessageReceiveCount = 10;

type IFailureReason = "CouldNotDetermineMessageSource" | "AWS.SimpleQueueService.NonExistentQueue";

export class MessageMoveTask {
  ApproximateNumberOfMessagesMoved: number = 0;
  ApproximateNumberOfMessagesToMove: number = 0;
  DestinationArn?: string;
  FailureReason?: IFailureReason;
  MaxNumberOfMessagesPerSecond?: number;
  #MaxNumberOfMessagesPerSecond: number = 300;
  SourceArn: string;
  StartedTimestamp: number;
  Status: "RUNNING" | "COMPLETED" | "CANCELLING" | "CANCELLED" | "FAILED" = "RUNNING";
  TaskHandle: string;

  taskId: string;
  #job: NodeJS.Timeout;
  #emptyMessageReceivedCount = 0;
  #sourceQueue: Queue;
  #DestinationQueueName?: string;
  constructor({ DestinationArn, SourceArn, MaxNumberOfMessagesPerSecond }: IStartMessageMoveTask, sourceQueue: Queue) {
    this.taskId = randomUUID();
    this.#sourceQueue = sourceQueue;
    this.DestinationArn = DestinationArn;

    if (this.DestinationArn) {
      this.#DestinationQueueName = getQueueNameFromArn(this.DestinationArn);
    }

    this.SourceArn = SourceArn;
    this.TaskHandle = Buffer.from(JSON.stringify({ taskId: this.taskId, sourceArn: this.SourceArn }), "utf-8").toString("base64");

    if (MaxNumberOfMessagesPerSecond) {
      this.MaxNumberOfMessagesPerSecond = MaxNumberOfMessagesPerSecond;
      this.#MaxNumberOfMessagesPerSecond = MaxNumberOfMessagesPerSecond;
    }

    const { ApproximateNumberOfMessages, ApproximateNumberOfMessagesNotVisible } = this.#sourceQueue.getAttributes([
      "ApproximateNumberOfMessages",
      "ApproximateNumberOfMessagesNotVisible",
    ]);

    this.ApproximateNumberOfMessagesToMove = Number(ApproximateNumberOfMessages) - Number(ApproximateNumberOfMessagesNotVisible);

    this.StartedTimestamp = Date.now();

    this.#job = setInterval(async () => {
      await this.#move();
    }, 1000);
  }

  cancel() {
    if (this.Status != "RUNNING") {
      throw new InvalidParameterValueException("Only active tasks can be cancelled.");
    }

    this.Status = "CANCELLING";
    return this.ApproximateNumberOfMessagesMoved;
  }

  getState() {
    return {
      ApproximateNumberOfMessagesMoved: this.ApproximateNumberOfMessagesMoved,
      ApproximateNumberOfMessagesToMove: this.ApproximateNumberOfMessagesToMove,
      DestinationArn: this.DestinationArn,
      FailureReason: this.FailureReason,
      MaxNumberOfMessagesPerSecond: this.MaxNumberOfMessagesPerSecond,
      SourceArn: this.SourceArn,
      StartedTimestamp: this.StartedTimestamp,
      Status: this.Status,
      TaskHandle: this.Status == "RUNNING" ? this.TaskHandle : undefined,
    };
  }

  async #move() {
    if (this.Status == "CANCELLING") {
      clearInterval(this.#job);
      this.Status = "CANCELLED";
      return;
    }
    const messages = await this.#sourceQueue.receive({ MaxNumberOfMessages: this.#MaxNumberOfMessagesPerSecond });

    if (!messages.length) {
      this.#emptyMessageReceivedCount++;
    }

    for (const msg of messages) {
      const errMsg = this.#processMessageOrReturnError(msg);

      if (errMsg) {
        this.FailureReason = errMsg;
        this.Status = "FAILED";
        clearInterval(this.#job);
        return;
      }

      this.ApproximateNumberOfMessagesMoved++;
    }

    if (this.ApproximateNumberOfMessagesMoved >= this.ApproximateNumberOfMessagesToMove) {
      clearInterval(this.#job);
      this.Status = "COMPLETED";
      return;
    }

    if (this.#emptyMessageReceivedCount >= MAX_EmptyMessageReceiveCount) {
      clearInterval(this.#job);
      this.Status = "COMPLETED";
    }
  }

  #processMessageOrReturnError(msg: any): IFailureReason | undefined {
    const { DeadLetterQueueSourceArn, AWSTraceHeader, MessageGroupId, MessageDeduplicationId } = msg.attributes;

    if (!this.DestinationArn && !DeadLetterQueueSourceArn) {
      return "CouldNotDetermineMessageSource";
    }

    let queue: Queue | undefined = undefined;
    if (this.DestinationArn) {
      queue = findQueue(this.#DestinationQueueName!);
    } else {
      queue = findQueue(getQueueNameFromArn(DeadLetterQueueSourceArn));
    }

    if (!queue) {
      return "AWS.SimpleQueueService.NonExistentQueue";
    }

    const newMsg: any = {
      MessageBody: msg.MessageBody,
      MessageGroupId,
      MessageDeduplicationId,
    };

    if (AWSTraceHeader) {
      newMsg.MessageSystemAttributes = { AWSTraceHeader: { DataType: "String", StringValue: AWSTraceHeader } };
    }

    if (msg.MessageAttributes) {
      newMsg.MessageAttributes = msg.MessageAttributes;
    }

    queue.setRecord(newMsg);
    try {
      this.#sourceQueue.delete(msg.ReceiptHandle);
    } catch (error) {
      DEV: console.warn(error);
    }
  }
}

const findQueue = (QueueName: string) => {
  const foundQueue = Queue.Queues.find((x) => x.QueueName == QueueName);

  if (!foundQueue || Queue.deletingQueues.has(foundQueue.QueueName)) {
    return;
  }

  return foundQueue;
};
