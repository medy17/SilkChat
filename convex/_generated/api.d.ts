/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account_activity from "../account_activity.js";
import type * as account_activity_node from "../account_activity_node.js";
import type * as account_deletion from "../account_deletion.js";
import type * as account_exports from "../account_exports.js";
import type * as account_exports_node from "../account_exports_node.js";
import type * as aggregates from "../aggregates.js";
import type * as analytics from "../analytics.js";
import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as chat_http_generate_thread_name from "../chat_http/generate_thread_name.js";
import type * as chat_http_get_model from "../chat_http/get_model.js";
import type * as chat_http_manual_stream_transform from "../chat_http/manual_stream_transform.js";
import type * as chat_http_prompt from "../chat_http/prompt.js";
import type * as chat_http_shared from "../chat_http/shared.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as direct_uploads from "../direct_uploads.js";
import type * as fal_billing_node from "../fal_billing_node.js";
import type * as fal_webhooks from "../fal_webhooks.js";
import type * as folders from "../folders.js";
import type * as http from "../http.js";
import type * as image_generation_jobs from "../image_generation_jobs.js";
import type * as images from "../images.js";
import type * as images_node from "../images_node.js";
import type * as import_jobs from "../import_jobs.js";
import type * as import_jobs_http from "../import_jobs_http.js";
import type * as import_jobs_mirror_node from "../import_jobs_mirror_node.js";
import type * as import_jobs_node from "../import_jobs_node.js";
import type * as lemon_squeezy_http from "../lemon_squeezy_http.js";
import type * as lib_account_activity from "../lib/account_activity.js";
import type * as lib_account_deletion from "../lib/account_deletion.js";
import type * as lib_account_deletion_gate from "../lib/account_deletion_gate.js";
import type * as lib_account_deletion_restore from "../lib/account_deletion_restore.js";
import type * as lib_account_deletion_status from "../lib/account_deletion_status.js";
import type * as lib_auth_origins from "../lib/auth_origins.js";
import type * as lib_backend_to_ui_messages from "../lib/backend_to_ui_messages.js";
import type * as lib_context_limits from "../lib/context_limits.js";
import type * as lib_credits from "../lib/credits.js";
import type * as lib_db_to_core_messages from "../lib/db_to_core_messages.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_fal_r2_ingest from "../lib/fal_r2_ingest.js";
import type * as lib_file_constants from "../lib/file_constants.js";
import type * as lib_file_listing from "../lib/file_listing.js";
import type * as lib_google_auth from "../lib/google_auth.js";
import type * as lib_google_provider from "../lib/google_provider.js";
import type * as lib_identity from "../lib/identity.js";
import type * as lib_image_compression_node from "../lib/image_compression_node.js";
import type * as lib_image_generation_context_images_node from "../lib/image_generation/context_images_node.js";
import type * as lib_image_generation_cost from "../lib/image_generation/cost.js";
import type * as lib_image_generation_reference_images_node from "../lib/image_generation/reference_images_node.js";
import type * as lib_image_generation_shared from "../lib/image_generation/shared.js";
import type * as lib_lemon_squeezy from "../lib/lemon_squeezy.js";
import type * as lib_model_abilities from "../lib/model_abilities.js";
import type * as lib_models from "../lib/models.js";
import type * as lib_models_anthropic from "../lib/models/anthropic.js";
import type * as lib_models_deepseek from "../lib/models/deepseek.js";
import type * as lib_models_fal_black_forest_labs from "../lib/models/fal/black_forest_labs.js";
import type * as lib_models_fal_bytedance from "../lib/models/fal/bytedance.js";
import type * as lib_models_fal_google from "../lib/models/fal/google.js";
import type * as lib_models_fal_index from "../lib/models/fal/index.js";
import type * as lib_models_fal_openai from "../lib/models/fal/openai.js";
import type * as lib_models_fal_shared from "../lib/models/fal/shared.js";
import type * as lib_models_fal_types from "../lib/models/fal/types.js";
import type * as lib_models_fal_xai from "../lib/models/fal/xai.js";
import type * as lib_models_google from "../lib/models/google.js";
import type * as lib_models_lifecycle from "../lib/models/lifecycle.js";
import type * as lib_models_meta from "../lib/models/meta.js";
import type * as lib_models_minimax from "../lib/models/minimax.js";
import type * as lib_models_moonshot from "../lib/models/moonshot.js";
import type * as lib_models_openai from "../lib/models/openai.js";
import type * as lib_models_qwen from "../lib/models/qwen.js";
import type * as lib_models_reasoning from "../lib/models/reasoning.js";
import type * as lib_models_types from "../lib/models/types.js";
import type * as lib_models_xai from "../lib/models/xai.js";
import type * as lib_models_xiaomi from "../lib/models/xiaomi.js";
import type * as lib_models_zai from "../lib/models/zai.js";
import type * as lib_openrouter_attribution from "../lib/openrouter_attribution.js";
import type * as lib_persisted_tool_error from "../lib/persisted_tool_error.js";
import type * as lib_persistent_sandbox_policy from "../lib/persistent_sandbox_policy.js";
import type * as lib_personas from "../lib/personas.js";
import type * as lib_provider_factory from "../lib/provider_factory.js";
import type * as lib_resumable_stream_context from "../lib/resumable_stream_context.js";
import type * as lib_sandbox_billing from "../lib/sandbox_billing.js";
import type * as lib_sandbox_errors from "../lib/sandbox_errors.js";
import type * as lib_supermemory_api from "../lib/supermemory_api.js";
import type * as lib_supermemory_memory_change from "../lib/supermemory_memory_change.js";
import type * as lib_thread_import_core from "../lib/thread_import_core.js";
import type * as lib_toolkit from "../lib/toolkit.js";
import type * as lib_tools_adapters_index from "../lib/tools/adapters/index.js";
import type * as lib_tools_adapters_perplexity_search_adapter from "../lib/tools/adapters/perplexity_search_adapter.js";
import type * as lib_tools_adapters_search_adapter from "../lib/tools/adapters/search_adapter.js";
import type * as lib_tools_availability from "../lib/tools/availability.js";
import type * as lib_tools_blocked from "../lib/tools/blocked.js";
import type * as lib_tools_code_execution from "../lib/tools/code_execution.js";
import type * as lib_tools_code_execution_artifacts from "../lib/tools/code_execution_artifacts.js";
import type * as lib_tools_code_execution_node from "../lib/tools/code_execution_node.js";
import type * as lib_tools_image_generation from "../lib/tools/image_generation.js";
import type * as lib_tools_mcp_adapter from "../lib/tools/mcp_adapter.js";
import type * as lib_tools_native_chart from "../lib/tools/native_chart.js";
import type * as lib_tools_supermemory from "../lib/tools/supermemory.js";
import type * as lib_tools_web_search from "../lib/tools/web_search.js";
import type * as lib_usage_metering from "../lib/usage_metering.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as model_provider_metadata from "../model_provider_metadata.js";
import type * as model_provider_metadata_node from "../model_provider_metadata_node.js";
import type * as persistent_sandboxes from "../persistent_sandboxes.js";
import type * as persistent_sandboxes_node from "../persistent_sandboxes_node.js";
import type * as persona_uploads from "../persona_uploads.js";
import type * as personas from "../personas.js";
import type * as private_blur from "../private_blur.js";
import type * as private_blur_node from "../private_blur_node.js";
import type * as schema_access from "../schema/access.js";
import type * as schema_account_activity from "../schema/account_activity.js";
import type * as schema_account_deletion from "../schema/account_deletion.js";
import type * as schema_account_export from "../schema/account_export.js";
import type * as schema_billing from "../schema/billing.js";
import type * as schema_credit_reservations from "../schema/credit_reservations.js";
import type * as schema_credits from "../schema/credits.js";
import type * as schema_folders from "../schema/folders.js";
import type * as schema_generated_image from "../schema/generated_image.js";
import type * as schema_generated_image_facets from "../schema/generated_image_facets.js";
import type * as schema_image_generation_job from "../schema/image_generation_job.js";
import type * as schema_import_job from "../schema/import_job.js";
import type * as schema_message from "../schema/message.js";
import type * as schema_model_provider_metadata from "../schema/model_provider_metadata.js";
import type * as schema_parts from "../schema/parts.js";
import type * as schema_persistent_sandbox from "../schema/persistent_sandbox.js";
import type * as schema_persona from "../schema/persona.js";
import type * as schema_settings from "../schema/settings.js";
import type * as schema_streams from "../schema/streams.js";
import type * as schema_thread from "../schema/thread.js";
import type * as schema_usage from "../schema/usage.js";
import type * as settings from "../settings.js";
import type * as speech_to_text from "../speech_to_text.js";
import type * as streams from "../streams.js";
import type * as supermemory_node from "../supermemory_node.js";
import type * as threads from "../threads.js";

import type * as lib_models_microsoft from "../lib/models/microsoft.js";

import type * as lib_speech_config from "../lib/speech_config.js";

import type * as speech_audio from "../speech_audio.js";

import type * as text_to_speech from "../text_to_speech.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "text_to_speech": typeof text_to_speech;
  "speech_audio": typeof speech_audio;
  "lib/speech_config": typeof lib_speech_config;
  "lib/models/microsoft": typeof lib_models_microsoft;
  account_activity: typeof account_activity;
  account_activity_node: typeof account_activity_node;
  account_deletion: typeof account_deletion;
  account_exports: typeof account_exports;
  account_exports_node: typeof account_exports_node;
  aggregates: typeof aggregates;
  analytics: typeof analytics;
  attachments: typeof attachments;
  auth: typeof auth;
  billing: typeof billing;
  "chat_http/generate_thread_name": typeof chat_http_generate_thread_name;
  "chat_http/get_model": typeof chat_http_get_model;
  "chat_http/manual_stream_transform": typeof chat_http_manual_stream_transform;
  "chat_http/prompt": typeof chat_http_prompt;
  "chat_http/shared": typeof chat_http_shared;
  credits: typeof credits;
  crons: typeof crons;
  direct_uploads: typeof direct_uploads;
  fal_billing_node: typeof fal_billing_node;
  fal_webhooks: typeof fal_webhooks;
  folders: typeof folders;
  http: typeof http;
  image_generation_jobs: typeof image_generation_jobs;
  images: typeof images;
  images_node: typeof images_node;
  import_jobs: typeof import_jobs;
  import_jobs_http: typeof import_jobs_http;
  import_jobs_mirror_node: typeof import_jobs_mirror_node;
  import_jobs_node: typeof import_jobs_node;
  lemon_squeezy_http: typeof lemon_squeezy_http;
  "lib/account_activity": typeof lib_account_activity;
  "lib/account_deletion": typeof lib_account_deletion;
  "lib/account_deletion_gate": typeof lib_account_deletion_gate;
  "lib/account_deletion_restore": typeof lib_account_deletion_restore;
  "lib/account_deletion_status": typeof lib_account_deletion_status;
  "lib/auth_origins": typeof lib_auth_origins;
  "lib/backend_to_ui_messages": typeof lib_backend_to_ui_messages;
  "lib/context_limits": typeof lib_context_limits;
  "lib/credits": typeof lib_credits;
  "lib/db_to_core_messages": typeof lib_db_to_core_messages;
  "lib/encryption": typeof lib_encryption;
  "lib/fal_r2_ingest": typeof lib_fal_r2_ingest;
  "lib/file_constants": typeof lib_file_constants;
  "lib/file_listing": typeof lib_file_listing;
  "lib/google_auth": typeof lib_google_auth;
  "lib/google_provider": typeof lib_google_provider;
  "lib/identity": typeof lib_identity;
  "lib/image_compression_node": typeof lib_image_compression_node;
  "lib/image_generation/context_images_node": typeof lib_image_generation_context_images_node;
  "lib/image_generation/cost": typeof lib_image_generation_cost;
  "lib/image_generation/reference_images_node": typeof lib_image_generation_reference_images_node;
  "lib/image_generation/shared": typeof lib_image_generation_shared;
  "lib/lemon_squeezy": typeof lib_lemon_squeezy;
  "lib/model_abilities": typeof lib_model_abilities;
  "lib/models": typeof lib_models;
  "lib/models/anthropic": typeof lib_models_anthropic;
  "lib/models/deepseek": typeof lib_models_deepseek;
  "lib/models/fal/black_forest_labs": typeof lib_models_fal_black_forest_labs;
  "lib/models/fal/bytedance": typeof lib_models_fal_bytedance;
  "lib/models/fal/google": typeof lib_models_fal_google;
  "lib/models/fal/index": typeof lib_models_fal_index;
  "lib/models/fal/openai": typeof lib_models_fal_openai;
  "lib/models/fal/shared": typeof lib_models_fal_shared;
  "lib/models/fal/types": typeof lib_models_fal_types;
  "lib/models/fal/xai": typeof lib_models_fal_xai;
  "lib/models/google": typeof lib_models_google;
  "lib/models/lifecycle": typeof lib_models_lifecycle;
  "lib/models/meta": typeof lib_models_meta;
  "lib/models/minimax": typeof lib_models_minimax;
  "lib/models/moonshot": typeof lib_models_moonshot;
  "lib/models/openai": typeof lib_models_openai;
  "lib/models/qwen": typeof lib_models_qwen;
  "lib/models/reasoning": typeof lib_models_reasoning;
  "lib/models/types": typeof lib_models_types;
  "lib/models/xai": typeof lib_models_xai;
  "lib/models/xiaomi": typeof lib_models_xiaomi;
  "lib/models/zai": typeof lib_models_zai;
  "lib/openrouter_attribution": typeof lib_openrouter_attribution;
  "lib/persisted_tool_error": typeof lib_persisted_tool_error;
  "lib/persistent_sandbox_policy": typeof lib_persistent_sandbox_policy;
  "lib/personas": typeof lib_personas;
  "lib/provider_factory": typeof lib_provider_factory;
  "lib/resumable_stream_context": typeof lib_resumable_stream_context;
  "lib/sandbox_billing": typeof lib_sandbox_billing;
  "lib/sandbox_errors": typeof lib_sandbox_errors;
  "lib/supermemory_api": typeof lib_supermemory_api;
  "lib/supermemory_memory_change": typeof lib_supermemory_memory_change;
  "lib/thread_import_core": typeof lib_thread_import_core;
  "lib/toolkit": typeof lib_toolkit;
  "lib/tools/adapters/index": typeof lib_tools_adapters_index;
  "lib/tools/adapters/perplexity_search_adapter": typeof lib_tools_adapters_perplexity_search_adapter;
  "lib/tools/adapters/search_adapter": typeof lib_tools_adapters_search_adapter;
  "lib/tools/availability": typeof lib_tools_availability;
  "lib/tools/blocked": typeof lib_tools_blocked;
  "lib/tools/code_execution": typeof lib_tools_code_execution;
  "lib/tools/code_execution_artifacts": typeof lib_tools_code_execution_artifacts;
  "lib/tools/code_execution_node": typeof lib_tools_code_execution_node;
  "lib/tools/image_generation": typeof lib_tools_image_generation;
  "lib/tools/mcp_adapter": typeof lib_tools_mcp_adapter;
  "lib/tools/native_chart": typeof lib_tools_native_chart;
  "lib/tools/supermemory": typeof lib_tools_supermemory;
  "lib/tools/web_search": typeof lib_tools_web_search;
  "lib/usage_metering": typeof lib_usage_metering;
  messages: typeof messages;
  migrations: typeof migrations;
  model_provider_metadata: typeof model_provider_metadata;
  model_provider_metadata_node: typeof model_provider_metadata_node;
  persistent_sandboxes: typeof persistent_sandboxes;
  persistent_sandboxes_node: typeof persistent_sandboxes_node;
  persona_uploads: typeof persona_uploads;
  personas: typeof personas;
  private_blur: typeof private_blur;
  private_blur_node: typeof private_blur_node;
  "schema/access": typeof schema_access;
  "schema/account_activity": typeof schema_account_activity;
  "schema/account_deletion": typeof schema_account_deletion;
  "schema/account_export": typeof schema_account_export;
  "schema/billing": typeof schema_billing;
  "schema/credit_reservations": typeof schema_credit_reservations;
  "schema/credits": typeof schema_credits;
  "schema/folders": typeof schema_folders;
  "schema/generated_image": typeof schema_generated_image;
  "schema/generated_image_facets": typeof schema_generated_image_facets;
  "schema/image_generation_job": typeof schema_image_generation_job;
  "schema/import_job": typeof schema_import_job;
  "schema/message": typeof schema_message;
  "schema/model_provider_metadata": typeof schema_model_provider_metadata;
  "schema/parts": typeof schema_parts;
  "schema/persistent_sandbox": typeof schema_persistent_sandbox;
  "schema/persona": typeof schema_persona;
  "schema/settings": typeof schema_settings;
  "schema/streams": typeof schema_streams;
  "schema/thread": typeof schema_thread;
  "schema/usage": typeof schema_usage;
  settings: typeof settings;
  speech_to_text: typeof speech_to_text;
  streams: typeof streams;
  supermemory_node: typeof supermemory_node;
  threads: typeof threads;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  aggregateFolderThreads: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregateFolderThreads">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
