import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ClientFactory, JsonRpcTransportFactory, RestTransportFactory, DefaultAgentCardResolver, Client, RestTransport } from '@a2a-js/sdk/client';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { MessageSendParams, Part, AgentCard, Message as SdkMessage } from '@a2a-js/sdk';
import { MessageProcessor } from '@a2ui/angular';
import * as Types from '@a2ui/web_core/types/types';
import { getAuth } from 'firebase/auth';
import { FirebaseService } from './firebase.service';

export interface A2AStreamEventData {
  kind: 'message' | 'task' | 'artifact-update' | 'status-update' | 'progress-update' | 'ping';
  parts?: Part[];
  history?: SdkMessage[];
  artifacts?: { parts?: Part[] }[];
  artifact?: { id?: string; artifactId?: string; name?: string; description?: string; parts?: Part[] };
  status?: { state: string; message?: { parts?: Part[] } };
  messageId?: string;
  append?: boolean;
  [key: string]: any;
}

export interface Agent {
  id: string;
  name: string;
  address: string; // The URL of the agent card
  description?: string;
  card?: AgentCard;
}

export interface LocalArtifact {
  id: string;
  name?: string;
  description?: string;
  parts: Part[];
  content: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  title: string;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  artifacts?: LocalArtifact[];
  authRequired?: boolean;
  timestamp: number;
  events: A2AStreamEventData[]; // Source of truth for replay
  messageId?: string; // ID from the server/SDK for deduplication
  surfaceIds?: string[];
}

const proxyFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

  const headers = new Headers(init?.headers);
  headers.set('X-A2A-Extensions', 'https://a2ui.org/a2a-extension/a2ui/v0.8');

  try {
    const auth = getAuth();
    if (auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        headers.set('Authorization', `Bearer ${idToken}`);
      }
    }
  } catch (error) {
    // getAuth() will throw if default app is not initialized yet, which is fine to ignore
  }

  return fetch(proxyUrl, { ...init, headers });
};

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  public agents = signal<Agent[]>([]);
  public conversations = signal<Conversation[]>([]);
  public currentConversation = signal<Conversation | null>(null);
  public messages = signal<Record<string, Message[]>>({}); // Keyed by conversation.id
  public isTyping = signal<Record<string, boolean>>({}); // Keyed by conversation.id
  private activeTaskIds = new Map<string, string>();
  private activeTaskAbortControllers = new Map<string, AbortController>();
  public processor = inject(MessageProcessor);
  private platformId = inject(PLATFORM_ID);
  private firebase = inject(FirebaseService);


  constructor() {
    this.loadAgents();
    this.loadDefaultAgents();
    this.loadConversations();
    this.loadMessages();

    this.processor.events.subscribe(async (event) => {
      try {
        const responses = await this.sendA2UIRequest(event.message);
        event.completion.next(responses);
        event.completion.complete();
      } catch (err) {
        event.completion.error(err);
      }
    });


  }

  private async loadDefaultAgents() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const defaultsInitialized = await idbGet('defaultsInitialized');
        if (!defaultsInitialized) {
          const res = await fetch('/api/app-config');
          const config = await res.json();
          if (config.defaultAgents) {
            const urls = config.defaultAgents.split(',').map((u: string) => u.trim()).filter((u: string) => u.length > 0);
            for (const url of urls) {
              try {
                await this.addAgent(url);
                console.log(`[A2A] Automatically loaded default agent: ${url}`);
              } catch (e) {
                console.error(`[A2A] Failed to automatically load default agent: ${url}`, e);
              }
            }
          }
          await idbSet('defaultsInitialized', true);
        }
      } catch (e) {
        console.error('Failed to init defaults', e);
      }
    }
  }

  private async loadAgents() {
    try {
      const stored = await idbGet('a2a_agents');
      if (stored) {
        this.agents.set(stored);
      } else {
        const legacy = localStorage.getItem('a2a_agents');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          this.agents.set(parsed);
          this.saveAgents();
        }
      }
    } catch (e) {
      console.error('Failed to load agents from IndexedDB', e);
    }
  }

  private saveAgents() {
    idbSet('a2a_agents', this.agents()).catch(e => console.error('Failed to save agents to IndexedDB', e));
  }

  private async loadConversations() {
    try {
      const stored = await idbGet('a2a_conversations');
      if (stored) {
        this.conversations.set(stored);
      } else {
        const legacy = localStorage.getItem('a2a_conversations');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          this.conversations.set(parsed);
          this.saveConversations();
        }
      }
    } catch (e) {
      console.error('Failed to load conversations from IndexedDB', e);
    }
  }

  private saveConversations() {
    idbSet('a2a_conversations', this.conversations()).catch(e => console.error('Failed to save conversations to IndexedDB', e));
  }

  private async loadMessages() {
    try {
      const stored = await idbGet('a2a_messages');
      if (stored) {
        this.messages.set(stored);
      } else {
        const legacy = localStorage.getItem('a2a_messages');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          this.messages.set(parsed);
          this.saveMessages();
        }
      }
    } catch (e) {
      console.error('Failed to load messages from IndexedDB', e);
    }
  }

  private saveMessages() {
    idbSet('a2a_messages', this.messages()).catch(e => console.error('Failed to save messages to IndexedDB', e));
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `http://${url}`;
    }
    return url;
  }

  async addAgent(address: string) {
    try {
      const normalizedAddress = this.normalizeUrl(address);
      const path = normalizedAddress.endsWith('.json') ? '' : undefined;

      let card: AgentCard;
      const resolverNoAuth = new DefaultAgentCardResolver({
        fetchImpl: (input, init) => {
          const newInit = { ...init };
          newInit.headers = new Headers(newInit.headers);
          newInit.headers.set('X-Skip-App-Auth', 'true');
          return proxyFetch(input, newInit);
        }
      });

      try {
        card = await resolverNoAuth.resolve(normalizedAddress, path);
      } catch (e) {
        console.log('[A2A] Failed to fetch card without auth, retrying using App Identity Token...');
        const resolverWithAuth = new DefaultAgentCardResolver({ fetchImpl: proxyFetch });
        card = await resolverWithAuth.resolve(normalizedAddress, path);
      }

      const newAgent: Agent = {
        id: crypto.randomUUID(),
        name: card.name || 'Unknown Agent',
        address: normalizedAddress,
        description: card.description,
        card
      };
      this.agents.update(agents => [...agents, newAgent]);
      this.saveAgents();
      return newAgent;
    } catch (error) {
      console.error('Failed to resolve agent card', error);
      throw error;
    }
  }

  private async getAgentClientFactory(agent: Agent) {
    let agentAuthHeader: string | undefined;

    if (agent.card?.security && agent.card?.securitySchemes) {
      for (const secReq of agent.card.security) {
        for (const [schemeName, scopes] of Object.entries(secReq)) {
          const scheme = agent.card.securitySchemes[schemeName];
          if (scheme && scheme.type === 'oauth2') {
            const token = await this.firebase.getAgentAccessToken(scopes);
            if (token) {
              agentAuthHeader = `Bearer ${token}`;
              break;
            }
          } else if (scheme && scheme.type === 'openIdConnect') {
            const user = this.firebase.currentUser();
            if (user) {
              const idToken = await user.getIdToken();
              agentAuthHeader = `Bearer ${idToken}`;
              break;
            }
          }
        }
        if (agentAuthHeader) break;
      }
    }

    const customProxyFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const newInit = { ...init };
      newInit.headers = new Headers(newInit.headers);
      if (agentAuthHeader) {
        newInit.headers.set('X-Agent-Authorization', agentAuthHeader);
      }
      return proxyFetch(input, newInit);
    };

    return new ClientFactory({
      transports: [
        new JsonRpcTransportFactory({ fetchImpl: customProxyFetch }),
        new RestTransportFactory({ fetchImpl: customProxyFetch })
      ],
      cardResolver: new DefaultAgentCardResolver({ fetchImpl: customProxyFetch })
    });
  }

  removeAgent(id: string) {
    this.agents.update(agents => agents.filter(a => a.id !== id));
    this.saveAgents();

    const convsToDelete = this.conversations().filter(c => c.agentId === id);
    this.conversations.update(c => c.filter(conv => conv.agentId !== id));
    this.saveConversations();

    this.messages.update(msgs => {
      const newMsgs = { ...msgs };
      for (const conv of convsToDelete) {
        delete newMsgs[conv.id];
      }
      return newMsgs;
    });
    this.saveMessages();

    if (this.currentConversation()?.agentId === id) {
      this.currentConversation.set(null);
    }
  }

  createConversation(agentId: string, title?: string) {
    const agent = this.agents().find(a => a.id === agentId);
    if (!agent) return null;

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const newConv: Conversation = {
      id: crypto.randomUUID(),
      agentId,
      title: title || `${dateStr} - ${agent.name}`,
      updatedAt: Date.now()
    };

    this.conversations.update(c => [newConv, ...c]);
    this.saveConversations();
    this.selectConversation(newConv);
    return newConv;
  }

  renameConversation(id: string, newTitle: string) {
    this.conversations.update(c => c.map(conv => conv.id === id ? { ...conv, title: newTitle } : conv));
    this.saveConversations();
    if (this.currentConversation()?.id === id) {
      this.currentConversation.update(c => c ? { ...c, title: newTitle } : null);
    }
  }

  async selectConversation(conversation: Conversation) {
    if (this.currentConversation()?.id === conversation.id) return;

    // Clear A2UI state from previous conversation
    this.clearA2UIState();

    this.currentConversation.set(conversation);

    // Replay history for this conversation
    this.replayConversation(conversation.id);

    // Resubscribe if online
    if (navigator.onLine) {
      await this.resubscribeToConversation(conversation);
    }
  }

  async cancelTask(conversationId: string) {
    const taskId = this.activeTaskIds.get(conversationId);

    // We instantiate a throwaway client here just to fire the cancel RPC
    if (taskId) {
      const conv = this.conversations().find(c => c.id === conversationId);
      const agents = this.agents();
      const agent = agents.find(a => a.id === conv?.agentId);
      if (agent) {
        try {
          const factory = await this.getAgentClientFactory(agent);
          let client: Client;

          if (agent.card) {
            client = await factory.createFromAgentCard(agent.card);
          } else {
            const normalizedAddress = this.normalizeUrl(agent.address);
            const path = normalizedAddress.endsWith('.json') ? '' : undefined;
            client = await factory.createFromUrl(normalizedAddress, path);
          }
          console.log(`[A2A] Cancelling task: ${taskId}`);
          await client.cancelTask({ id: taskId });
        } catch (e) {
          console.error("Failed to cancel task on agent", e);
        }
      }
    }

    // Immediately abort the local read stream
    const abortCtrl = this.activeTaskAbortControllers.get(conversationId);
    if (abortCtrl) {
      abortCtrl.abort();
      this.activeTaskAbortControllers.delete(conversationId);
    }

    const isTypingMap = this.isTyping();
    this.isTyping.set({ ...isTypingMap, [conversationId]: false });
  }

  private clearA2UIState() {
    const proc = this.processor as any;
    console.log('[ChatService] clearA2UIState called.');

    // Method 1: Use undocumented clearSurfaces method from A2uiMessageProcessor
    if (typeof proc.clearSurfaces === 'function') {
      console.log('[ChatService] clearing surfaces via clearSurfaces()');
      proc.clearSurfaces();
    } else {
      console.warn('[ChatService] clearSurfaces method not found on processor. Attempting manual clear via getSurfaces.');
      // Fallback: Try to access internal surfaces map via public getSurfaces if available
      if (typeof proc.getSurfaces === 'function') {
        const surfaces = proc.getSurfaces();
        if (surfaces instanceof Map) {
          console.log('[ChatService] Clearing surfaces map manually. Size before:', surfaces.size);
          surfaces.clear();
          console.log('[ChatService] Surfaces map cleared.');
        } else {
          console.warn('[ChatService] getSurfaces did not return a Map:', surfaces);
        }
      } else {
        console.error('[ChatService] Could not find a way to clear surfaces. createSurface/deleteSurface methods missing.');
      }
    }
  }


  private replayConversation(convId: string) {
    const msgs = this.messages()[convId] || [];
    for (const msg of msgs) {
      if (msg.events) {
        for (const event of msg.events) {
          this.processEventForA2UI(event);
        }
      }
    }
  }

  private processEventForA2UI(event: A2AStreamEventData) {
    let parts: Part[] | undefined;

    if (event.kind === 'message') {
      parts = event.parts;
    } else if (event.kind === 'task') {
      // Task history is handled by processing the individual messages within it if needed,
      // but usually we care about the *new* parts in a task event if any?
      // Actually task event contains `history`.
      // For replay, `msg.events` should contain the specific event that generated the message.
      // If we stored the `task` event, we should parse it.
      if (event.history) {
        for (const historyMsg of event.history) {
          if (historyMsg.role === 'agent') {
            this.processPartsForA2UI(historyMsg.parts);
          }
        }
      }
      if (event.artifacts) {
        for (const artifact of event.artifacts) {
          this.processPartsForA2UI(artifact.parts);
        }
      }
    } else if (event.kind === 'artifact-update') {
      if (event.artifact) {
        this.processPartsForA2UI(event.artifact.parts);
      }
    } else if (event.kind === 'status-update') {
      if (event.status?.message?.parts && event.status.state !== 'submitted') {
        this.processPartsForA2UI(event.status.message.parts);
      }
    }

    if (parts) {
      this.processPartsForA2UI(parts);
    }
  }

  private processPartsForA2UI(parts?: Part[]) {
    if (!parts) return;
    const messages: Types.ServerToClientMessage[] = [];
    for (const part of parts) {
      if (part.kind === 'data' && part.data) {
        if ('beginRendering' in part.data || 'surfaceUpdate' in part.data || 'dataModelUpdate' in part.data || 'deleteSurface' in part.data) {
          messages.push(part.data as unknown as Types.ServerToClientMessage);
        }
      }
    }
    if (messages.length > 0) {
      this.processor.processMessages(messages);
    }
  }

  private async resubscribeToConversation(conv: Conversation) {
    const agent = this.agents().find(a => a.id === conv.agentId);
    if (!agent) return;

    try {
      const factory = await this.getAgentClientFactory(agent);

      let client;
      if (agent.card) {
        client = await factory.createFromAgentCard(agent.card);
      } else {
        const normalizedAddress = this.normalizeUrl(agent.address);
        client = await factory.createFromUrl(normalizedAddress, normalizedAddress.endsWith('.json') ? '' : undefined);
      }

      // We use conv.id as taskId
      for await (const event of client.resubscribeTask({ id: conv.id })) {
        this.handleResubscribeEvent(conv.id, event);
      }
    } catch (e) {
      console.warn('Resubscribe failed (likely no active task or not supported):', e);
    }
  }

  private handleResubscribeEvent(convId: string, event: A2AStreamEventData) {
    // This logic mirrors sendMessageStream loop but merges into existing history
    if (event.kind === 'task') {
      if (event.history) {
        for (const sdkMsg of event.history) {
          this.addOrUpdateMessageFromSdk(convId, sdkMsg, event);
        }
      }
      // Artifacts?
    } else if (event.kind === 'message') {
      // This might be a new message or replay?
      // resubscribeTask typically streams the *history* first as a 'task' event (sometimes) or just new events?
      // Actually A2A spec says resubscribe returns events.
      // If we get a message, we assume it's part of the stream we missed or history.
      // We'll treat it as a message to add/update.
      this.addOrUpdateMessageFromEvent(convId, event);
    } else {
      // status-update, artifact-update
      // We should attach these to the latest agent message or create a new one?
      // Usually these are attached to a specific operation.
      // For simplicity, we'll append to the last agent message or create one.
      this.addOrUpdateMessageFromEvent(convId, event);
    }
  }

  private addOrUpdateMessageFromSdk(convId: string, sdkMsg: SdkMessage, sourceEvent: A2AStreamEventData) {
    // Check if we have this message
    const msgs = this.messages()[convId] || [];
    const existingIndex = msgs.findIndex(m => m.messageId === sdkMsg.messageId); // Need messageId on Message

    if (existingIndex !== -1) {
      // We have it. Do we need to update it?
      // Maybe strict equality check? For now assume it's same.
      // But we should ensure we have the *events* stored if we didn't before.
      // If we only stored legacy messages, we might want to attach this event?
      // It's hard to map 1:1 if we didn't store IDs.
      return;
    }

    // Create new message
    const syntheticEvent: A2AStreamEventData = {
      kind: 'message',
      messageId: sdkMsg.messageId,
      parts: sdkMsg.parts,
      // @ts-ignore: role might not be in A2AStreamEventData directly for message kind usually, but it's fine for our storage
      role: sdkMsg.role,
      timestamp: (sdkMsg as any).timestamp || Date.now()
    } as any;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      role: sdkMsg.role as 'user' | 'agent',
      content: '',
      artifacts: [],
      timestamp: (sdkMsg as any).timestamp || Date.now(), // Approximate if not in sdkMsg
      events: [syntheticEvent], // Store synthetic event to avoid duplicating history
      messageId: sdkMsg.messageId
    };

    this.updateMessageContentFromParts(newMessage, sdkMsg.parts);

    this.messages.update(m => ({
      ...m,
      [convId]: [...(m[convId] || []), newMessage]
    }));
    this.saveMessages();
    // Also update A2UI
    this.processPartsForA2UI(sdkMsg.parts);
  }

  private addOrUpdateMessageFromEvent(convId: string, event: A2AStreamEventData) {
    // logic similar to sendMessage loop
    // If it's a message event, it has messageId.
    let messageId: string | undefined;
    if (event.kind === 'message') messageId = event.messageId;

    if (messageId) {
      const msgs = this.messages()[convId] || [];
      const existing = msgs.find(m => m.messageId === messageId);
      if (existing) {
        // Update existing?
        // If it's the *same* event, ignore.
        // If it's a delta update? Sdk events usually aren't deltas for 'message' kind, they are the message.
        return;
      }
    }

    // If it's an update (artifact/status) it might not have messageId or might refer to parent context.
    // We usually append these to the conversation flow.
    // Let's find the last message.
    const msgs = this.messages()[convId] || [];
    const lastMsg = msgs[msgs.length - 1];

    // Determine if we should append to last message or create new
    let targetMsg: Message;
    let isNew = false;

    if (lastMsg && lastMsg.role === 'agent' && (event.kind !== 'message' || !messageId)) {
      // Append to last agent message if it's an update or related
      targetMsg = { ...lastMsg, events: [...lastMsg.events, event] };
    } else {
      // Create new message
      isNew = true;
      targetMsg = {
        id: crypto.randomUUID(),
        role: 'agent', // Event from server is usually agent (or system/tool)
        content: '',
        artifacts: [],
        timestamp: Date.now(),
        events: [event],
        messageId: messageId
      };
    }

    // Re-render targetMsg content/ui from its events
    // Wait, re-rendering from ALL events might be expensive/tricky for deltas.
    // For 'message' event it's full parts.
    // For 'status-update', it's parts to append.
    // Let's rely on incremental update logic like in sendMessage,
    // but we need to generalize it.

    this.updateMessageFromEvents(targetMsg);

    this.messages.update(m => {
      const list = m[convId] || [];
      if (isNew) return { ...m, [convId]: [...list, targetMsg] };
      return { ...m, [convId]: list.map(msg => msg.id === targetMsg.id ? targetMsg : msg) };
    });
    this.saveMessages();

    // Update A2UI
    this.processEventForA2UI(event);
  }

  private updateMessageFromEvents(msg: Message) {
    let content = '';
    const artifactsMap = new Map<string, LocalArtifact>();
    const surfaceIds = new Set<string>();

    for (const event of msg.events) {
      if (event.kind === 'message') {
        content = this.renderParts(event.parts || [], content, true);
      } else if (event.kind === 'artifact-update') {
        if (event.artifact) {
          const artId = event.artifact.id || event.artifact.artifactId || crypto.randomUUID();
          let localArt = artifactsMap.get(artId);
          if (!localArt) {
            localArt = {
              id: artId,
              name: event.artifact.name || 'Document',
              description: event.artifact.description,
              parts: [],
              content: ''
            };
            artifactsMap.set(artId, localArt);
          }
          if (event.append) {
            localArt.parts.push(...(event.artifact.parts || []));
          } else {
            localArt.parts = event.artifact.parts || [];
          }
        }
      } else if (event.kind === 'status-update') {
        if (event.status?.state === 'auth-required') {
          msg.authRequired = true;
        } else if (event.status?.state) {
          msg.authRequired = false;
        }

        if (event.status?.message?.parts && event.status.state !== 'submitted') {
          content = this.renderParts(event.status.message.parts, content, true);
        }
      }

      // Check all nested parts for A2UI 'beginRendering' commands to track surface ownership
      const checkA2UIParts = (parts?: Part[]) => {
        if (!parts) return;
        for (const part of parts) {
          if (part.kind === 'data' && part.data && 'beginRendering' in part.data) {
            const data = part.data as any;
            if (data.beginRendering.surfaceId) {
              surfaceIds.add(data.beginRendering.surfaceId);
            }
          }
        }
      }

      if (event.kind === 'message') checkA2UIParts(event.parts);
      if (event.kind === 'task' && event.history) event.history.forEach(h => checkA2UIParts(h.parts));
      if (event.kind === 'artifact-update' && event.artifact) checkA2UIParts(event.artifact.parts);
    }

    msg.surfaceIds = Array.from(surfaceIds);

    msg.content = content;
    msg.artifacts = Array.from(artifactsMap.values());

    const finalArtifacts: LocalArtifact[] = [];
    for (const art of msg.artifacts) {
      art.content = this.renderParts(art.parts, '', true);

      // Deduplicate mirrored content: prioritize rendering standard text, suppress the identical artifact card
      if (content.trim() === art.content.trim()) {
        continue; // Exclude the artifact entirely as it is perfectly matched in body
      } else if (art.content.trim() && content.includes(art.content.trim())) {
        continue; // Exclude if main message already wraps the exact content of artifact
      }
      finalArtifacts.push(art);
    }

    msg.artifacts = finalArtifacts;
  }

  private updateMessageContentFromParts(msg: Message, parts: Part[]) {
    msg.content = this.renderParts(parts, msg.content, false);
  }

  private renderParts(parts: Part[], currentContent: string, overwrite: boolean) {
    let c = overwrite ? '' : currentContent;
    for (const part of parts) {
      if (part.kind === 'text') {
        c += part.text;
      } else if (part.kind === 'file' && part.file) {
        let src = '';
        if ('uri' in part.file && part.file.uri) {
          src = part.file.uri;
        } else if ('bytes' in part.file && part.file.bytes) {
          src = `data:${part.file.mimeType || 'application/octet-stream'};base64,${part.file.bytes}`;
        }

        if (src) {
          const mimeType = part.file.mimeType || '';
          if (mimeType.startsWith('image/')) {
            c += `\n\n![image](${src})\n\n`;
          } else if (mimeType.startsWith('video/')) {
            c += `\n\n<video controls class="max-w-full rounded-lg mt-2 mb-2" src="${src}"></video>\n\n`;
          } else if (mimeType.startsWith('audio/')) {
            c += `\n\n<audio controls class="w-full mt-2 mb-2" src="${src}"></audio>\n\n`;
          } else {
            c += `\n\n[📄 Download attached file](${src})\n\n`;
          }
        }
      }
    }
    return c;
  }


  deleteConversation(id: string) {
    this.conversations.update(c => c.filter(conv => conv.id !== id));
    this.saveConversations();

    this.messages.update(msgs => {
      const newMsgs = { ...msgs };
      delete newMsgs[id];
      return newMsgs;
    });
    this.saveMessages();

    if (this.currentConversation()?.id === id) {
      this.currentConversation.set(null);
    }
  }

  async sendMessage(content: string, files: File[] = []) {
    const conv = this.currentConversation();
    if (!conv) return;
    const conversationId = conv.id;

    const agent = this.agents().find(a => a.id === conv.agentId);
    if (!agent) return;

    const fileParts: Part[] = await Promise.all(files.map(file => {
      return new Promise<Part>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve({
            kind: 'file',
            file: {
              mimeType: file.type || 'application/octet-stream',
              bytes: base64String,
              name: file.name
            }
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }));

    const allParts: Part[] = [];
    if (content.trim()) {
      allParts.push({ kind: 'text', text: content });
    }
    allParts.push(...fileParts);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: '',
      artifacts: [],
      timestamp: Date.now(),
      events: [{ kind: 'message', role: 'user', parts: allParts, timestamp: Date.now() } as any]
    };
    this.updateMessageContentFromParts(userMsg, allParts);

    this.messages.update(msgs => {
      const convMsgs = msgs[conv.id] || [];
      return { ...msgs, [conv.id]: [...convMsgs, userMsg] };
    });
    this.saveMessages();

    this.conversations.update(c => c.map(c => c.id === conv.id ? { ...c, updatedAt: Date.now() } : c));
    this.saveConversations();

    const agentMsg: Message = {
      id: crypto.randomUUID(),
      role: 'agent',
      content: '',
      artifacts: [],
      timestamp: Date.now(),
      events: []
    };

    this.messages.update(msgs => {
      const convMsgs = msgs[conv.id] || [];
      return { ...msgs, [conv.id]: [...convMsgs, agentMsg] };
    });
    this.saveMessages();

    const currentIsTyping = this.isTyping();
    this.isTyping.set({ ...currentIsTyping, [conversationId]: true });

    const abortController = new AbortController();
    this.activeTaskAbortControllers.set(conversationId, abortController);
    this.activeTaskIds.delete(conversationId);

    try {
      const factory = await this.getAgentClientFactory(agent);
      let client: Client;

      if (agent.card) {
        client = await factory.createFromAgentCard(agent.card);
      } else {
        const normalizedAddress = this.normalizeUrl(agent.address);
        const path = normalizedAddress.endsWith('.json') ? '' : undefined;
        client = await factory.createFromUrl(normalizedAddress, path);
      }

      const sendParams: MessageSendParams = {
        configuration: {
          blocking: true
        },
        message: {
          messageId: crypto.randomUUID(),
          contextId: conv.id,
          role: 'user',
          parts: allParts,
          kind: 'message',
          metadata: {
            a2uiClientCapabilities: {
              supportedCatalogIds: [
                'https://a2ui.org/specification/v0_8/standard_catalog_definition.json',
              ],
            },
          },
        }
      };

      for await (const event of client.sendMessageStream(sendParams, { signal: abortController.signal })) {
        if (event.kind === 'task' && (event as any).task?.id) {
          this.activeTaskIds.set(conversationId, (event as any).task.id);
        }

        // Store the raw event
        agentMsg.events.push(event);

        // Update content/UI locally
        this.addOrUpdateMessageFromEvent(conv.id, event);
      }
      this.saveMessages();

    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('abort')) {
        console.log(`Stream cancelled locally for conversation ${conversationId}`);
      } else {
        console.error('Failed to send message', err);
        // Add error message to chat
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: 'agent',
          content: `Error: Failed to send message. ${err.message || ''}`,
          timestamp: Date.now(),
          events: []
        };

        this.messages.update(msgs => {
          const convMsgs = msgs[conv.id] || [];
          return { ...msgs, [conv.id]: [...convMsgs, errorMsg] };
        });
        this.saveMessages();
      }
    } finally {
      this.activeTaskAbortControllers.delete(conversationId);
      const currentIsTypingEnd = this.isTyping();
      this.isTyping.set({ ...currentIsTypingEnd, [conversationId]: false });
    }
  }

  async sendA2UIRequest(clientEvent: Types.A2UIClientEventMessage): Promise<Types.ServerToClientMessage[]> {
    const conv = this.currentConversation();
    if (!conv) {
      console.warn('No active conversation to send A2UI event');
      return [];
    }
    const agent = this.agents().find(a => a.id === conv.agentId);
    if (!agent) return [];

    this.isTyping.update(state => ({ ...state, [conv.id]: true }));
    try {
      const factory = await this.getAgentClientFactory(agent);
      let client;
      if (agent.card) {
        client = await factory.createFromAgentCard(agent.card);
      } else {
        const normalizedAddress = this.normalizeUrl(agent.address);
        const path = normalizedAddress.endsWith('.json') ? '' : undefined;
        client = await factory.createFromUrl(normalizedAddress, path);
      }

      const sendParams: MessageSendParams = {
        configuration: { blocking: true },
        message: {
          messageId: crypto.randomUUID(),
          contextId: conv.id,
          role: 'user',
          parts: [{ kind: 'data', data: clientEvent as unknown as Record<string, unknown> }],
          kind: 'message',
          metadata: {
            a2uiClientCapabilities: {
              supportedCatalogIds: [
                'https://a2ui.org/specification/v0_8/standard_catalog_definition.json',
              ],
            },
          },
        },
      };

      const messages: Types.ServerToClientMessage[] = [];

      const processResponseParts = (parts?: Part[]) => {
        if (!parts) return;
        for (const part of parts) {
          if (part.kind === 'data') {
            if (part.data && ('beginRendering' in part.data || 'surfaceUpdate' in part.data || 'dataModelUpdate' in part.data || 'deleteSurface' in part.data)) {
              messages.push(part.data as unknown as Types.ServerToClientMessage);
            }
          }
        }
      };

      // Create a local Message representation of the User's UI interaction so it persists
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: '',
        artifacts: [],
        timestamp: Date.now(),
        events: [{ kind: 'message', role: 'user', parts: sendParams.message.parts, timestamp: Date.now() } as any]
      };

      this.messages.update(msgs => {
        const convMsgs = msgs[conv.id] || [];
        return { ...msgs, [conv.id]: [...convMsgs, userMsg] };
      });
      this.saveMessages();

      for await (const response of client.sendMessageStream(sendParams)) {
        if (response.kind === 'message') {
          processResponseParts(response.parts);
        } else if (response.kind === 'task') {
          if (response.history && response.history.length > 0) {
            const lastMsg = response.history[response.history.length - 1];
            if (lastMsg.role === 'agent') processResponseParts(lastMsg.parts);
          }
          if (response.artifacts) {
            for (const artifact of response.artifacts) processResponseParts(artifact.parts);
          }
        } else if (response.kind === 'artifact-update') {
          if (response.artifact && response.artifact.parts) processResponseParts(response.artifact.parts);
        } else if (response.kind === 'status-update') {
          if (response.status && response.status.message && response.status.message.parts && response.status.state != "submitted") {
            processResponseParts(response.status.message.parts);
          }
        }

        // Delegate the raw event directly to the conversation UI and IndexedDB
        this.addOrUpdateMessageFromEvent(conv.id, response);
      }

      this.saveMessages();

      // We omit manual this.processor.processMessages(messages)
      // because addOrUpdateMessageFromEvent already seamlessly propagates events upstream!
      return messages;
    } catch (err) {
      console.error('Failed to send A2UI event', err);
      return [];
    } finally {
      this.isTyping.update(state => ({ ...state, [conv.id]: false }));
    }
  }
}
