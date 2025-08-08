/**
 * @fileoverview Core processor abstraction for all runtimes
 */

import { processPartition } from './processors/partition.js';
import { processPackument } from './processors/packument.js';
import { processPartitionSet } from './processors/partition-set.js';
import { WorkItemTypes } from '@_all_docs/types';

export class Processor {
  /**
   * @param {import('./interfaces.js').RuntimeConfig} config
   */
  constructor(config) {
    this.storage = config.storage;
    this.queue = config.queue;
    this.env = config.env;
  }

  /**
   * Process a work item
   * @param {import('./interfaces.js').WorkItem} workItem
   * @returns {Promise<import('./interfaces.js').ProcessorResult>}
   */
  async process(workItem) {
    try {
      let result;
      
      switch (workItem.type) {
        case WorkItemTypes.PARTITION:
          result = await processPartition(workItem, this.env);
          break;
          
        case WorkItemTypes.PACKUMENT:
          result = await processPackument(workItem, this.env);
          break;
          
        case WorkItemTypes.PARTITION_SET:
          result = await processPartitionSet(
            workItem, 
            this.env,
            this.queue.enqueue.bind(this.queue)
          );
          break;
          
        default:
          throw new Error(`Unknown work item type: ${workItem.type}`);
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        error
      };
    }
  }

  /**
   * Handle HTTP request (runtime-agnostic)
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async handleRequest(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    if (url.pathname === '/work' && request.method === 'POST') {
      try {
        const workItem = await request.json();
        const result = await this.process(workItem);
        
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { 'content-type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  }
}