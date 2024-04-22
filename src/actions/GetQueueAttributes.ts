import { SqsCommand } from "./sqsCommand";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

export class GetQueueAttributes extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    const Attributes = this.foundQueue!.getAttributes(this.reqBody[this.isJsonProtocol ? "AttributeNames" : "AttributeName"]);

    this.res.end(this.#createResponse(Attributes));
  }

  #createResponse(Attributes?: Record<string, string>) {
    if (this.isJsonProtocol) {
      if (!Attributes) {
        return;
      }
      return JSON.stringify({ Attributes });
    }

    let body = `${xmlVersion}
    <GetQueueAttributesResponse ${xmlns}><GetQueueAttributesResult>`;

    if (Attributes) {
      body += Object.keys(Attributes)
        .map((x) => `<Attribute><Name>${x}</Name><Value>${Attributes[x]}</Value></Attribute>`)
        .join("");
    }

    body += `</GetQueueAttributesResult>${ResponseMetadata(this.RequestId)}
    </GetQueueAttributesResponse>`;

    return body;
  }
}
