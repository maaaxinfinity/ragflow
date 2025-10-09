#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
import json
import re
import logging
import os
import requests
from copy import deepcopy
from flask import Response, request
from flask_login import current_user, login_required
from api import settings
from api.db import LLMType
from api.db.db_models import APIToken
from api.db.services.conversation_service import ConversationService, structure_answer
from api.db.services.dialog_service import DialogService, ask, chat, gen_mindmap
from api.db.services.llm_service import LLMBundle
from api.db.services.search_service import SearchService
from api.db.services.tenant_llm_service import TenantLLMService
from api.db.services.user_service import TenantService, UserTenantService, UserService
from api.utils.api_utils import get_data_error_result, get_json_result, server_error_response, validate_request
from api.utils.auth_decorator import api_key_or_login_required
from rag.prompts.template import load_prompt
from rag.prompts.generator import chunks_format

# Model card API configuration - read from environment variable
# Default to localhost:3001 for development
MODEL_CARDS_API_URL = os.environ.get("MODEL_CARDS_API_URL", "http://localhost:3001/api/model-cards")


def fetch_model_card(model_card_id, access_token):
    """
    Fetch model card data from law-workspace API
    Returns model card dict or None if not found/error
    """
    try:
        response = requests.get(
            MODEL_CARDS_API_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            timeout=5,
        )

        if response.status_code == 200:
            result = response.json()
            if result.get("success") and result.get("data"):
                # Find the specific model card by ID
                for card in result["data"]:
                    if card.get("id") == model_card_id:
                        logging.info(f"[ModelCard] Found card {model_card_id}: {card.get('name')}")
                        return card
                logging.warning(f"[ModelCard] Card {model_card_id} not found in response")
        else:
            logging.error(f"[ModelCard] API returned status {response.status_code}")
    except Exception as e:
        logging.error(f"[ModelCard] Failed to fetch card {model_card_id}: {e}")

    return None


@manager.route("/model_cards", methods=["GET"])  # noqa: F821
@api_key_or_login_required
def list_model_cards(**kwargs):
    """
    Proxy endpoint to fetch model cards from law-workspace API
    Returns model cards list for the current user

    Hybrid authentication approach:
    - API Key: uses beta_token (from Authorization header)
    - Session: uses access_token (from current_user, already in memory)
    """
    try:
        auth_method = kwargs.get("auth_method")
        auth_token = None

        if auth_method == "api_key":
            # API key authentication - use beta_token directly from header
            # This is the token that law-workspace expects for API integrations
            authorization_str = request.headers.get("Authorization")
            if authorization_str:
                parts = authorization_str.split()
                if len(parts) == 2 and parts[0] == 'Bearer':
                    auth_token = parts[1]  # beta_token
                    logging.info(f"[ModelCards] Using beta_token from API key auth")
        elif auth_method == "session":
            # Session authentication - get or create beta_token for current user
            # law-workspace's /user/info endpoint requires beta_token
            from api.db.db_models import APIToken
            from api.db.services.api_service import APITokenService
            
            tokens = APIToken.query(tenant_id=current_user.id)
            if tokens and len(tokens) > 0:
                auth_token = tokens[0].beta
                logging.info(f"[ModelCards] Using existing beta_token for session user")
            else:
                # Create beta_token if not exists
                from api.utils import get_uuid
                from api.db import current_timestamp
                
                beta_token = "ragflow-" + get_uuid()[:32]
                token_obj = {
                    "tenant_id": current_user.id,
                    "token": get_uuid(),
                    "beta": beta_token,
                    "dialog_id": None,
                    "source": None,
                    "create_time": current_timestamp(),
                    "update_time": current_timestamp(),
                }
                APITokenService.save(**token_obj)
                auth_token = beta_token
                logging.info(f"[ModelCards] Created new beta_token for session user: {beta_token}")

        if not auth_token:
            logging.error(f"[ModelCards] No auth token - auth_method: {auth_method}, current_user: {current_user}, is_authenticated: {getattr(current_user, 'is_authenticated', False)}")
            return get_data_error_result(message="No auth token available. Please login with Authorization header.")

        # Fetch model cards from law-workspace
        # Both beta_token and access_token work with /user/info endpoint
        response = requests.get(
            MODEL_CARDS_API_URL,
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json",
            },
            timeout=5,
        )

        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                return get_json_result(data=result.get("data", []))
            else:
                return get_data_error_result(message="Model cards API returned success=false")
        else:
            logging.error(f"[ModelCards] API returned status {response.status_code}")
            return get_data_error_result(message=f"Failed to fetch model cards: {response.status_code}")

    except Exception as e:
        logging.exception(e)
        return server_error_response(e)


@manager.route("/set", methods=["POST"])  # noqa: F821
@api_key_or_login_required
def set_conversation(**kwargs):
    req = request.json
    conv_id = req.get("conversation_id")
    is_new = req.get("is_new")
    name = req.get("name", "New conversation")

    # Get user_id based on authentication method
    auth_method = kwargs.get("auth_method")
    if auth_method == "api_key":
        # API key authentication - get tenant_id from token (tenant_id = user_id in this system)
        # Also accept user_id from request for compatibility
        user_id = req.get("user_id") or kwargs.get("tenant_id")
        if not user_id:
            return get_data_error_result(message="user_id is required when using API key authentication")
    else:
        # Session authentication
        user_id = current_user.id

    req["user_id"] = user_id

    if len(name) > 255:
        name = name[0:255]

    del req["is_new"]
    if not is_new:
        del req["conversation_id"]
        try:
            if not ConversationService.update_by_id(conv_id, req):
                return get_data_error_result(message="Conversation not found!")
            e, conv = ConversationService.get_by_id(conv_id)
            if not e:
                return get_data_error_result(message="Fail to update a conversation!")
            conv = conv.to_dict()
            return get_json_result(data=conv)
        except Exception as e:
            return server_error_response(e)

    try:
        e, dia = DialogService.get_by_id(req["dialog_id"])
        if not e:
            return get_data_error_result(message="Dialog not found")

        # Extract model_card_id from request (optional for backward compatibility)
        model_card_id = req.get("model_card_id")

        initial_messages = [{"role": "assistant", "content": dia.prompt_config["prologue"]}]
        conv = {
            "id": conv_id,
            "dialog_id": req["dialog_id"],
            "name": name,
            "message": initial_messages,
            "user_id": user_id,
            "reference": [],
            "model_card_id": model_card_id,  # Add model_card_id
            "message_count": len(initial_messages),  # FIX: Track message count
        }
        ConversationService.save(**conv)
        return get_json_result(data=conv)
    except Exception as e:
        return server_error_response(e)


@manager.route("/get", methods=["GET"])  # noqa: F821
@api_key_or_login_required
def get(**kwargs):
    conv_id = request.args["conversation_id"]
    try:
        e, conv = ConversationService.get_by_id(conv_id)
        if not e:
            return get_data_error_result(message="Conversation not found!")

        # Get tenant_id based on authentication method
        auth_method = kwargs.get("auth_method")
        if auth_method == "api_key":
            tenant_id = kwargs.get("tenant_id")
            # Verify dialog belongs to this tenant
            dialog = DialogService.query(tenant_id=tenant_id, id=conv.dialog_id)
            if not dialog or len(dialog) == 0:
                return get_json_result(data=False, message="Only owner of conversation authorized for this operation.", code=settings.RetCode.OPERATING_ERROR)
            avatar = dialog[0].icon
        else:
            # Session authentication
            tenants = UserTenantService.query(user_id=current_user.id)
            avatar = None
            for tenant in tenants:
                dialog = DialogService.query(tenant_id=tenant.tenant_id, id=conv.dialog_id)
                if dialog and len(dialog) > 0:
                    avatar = dialog[0].icon
                    break
            else:
                return get_json_result(data=False, message="Only owner of conversation authorized for this operation.", code=settings.RetCode.OPERATING_ERROR)

        for ref in conv.reference:
            if isinstance(ref, list):
                continue
            ref["chunks"] = chunks_format(ref)

        conv = conv.to_dict()
        conv["avatar"] = avatar
        return get_json_result(data=conv)
    except Exception as e:
        return server_error_response(e)


@manager.route("/getsse/<dialog_id>", methods=["GET"])  # type: ignore # noqa: F821
def getsse(dialog_id):
    token = request.headers.get("Authorization").split()
    if len(token) != 2:
        return get_data_error_result(message='Authorization is not valid!"')
    token = token[1]
    objs = APIToken.query(beta=token)
    if not objs:
        return get_data_error_result(message='Authentication error: API key is invalid!"')
    try:
        e, conv = DialogService.get_by_id(dialog_id)
        if not e:
            return get_data_error_result(message="Dialog not found!")
        conv = conv.to_dict()
        conv["avatar"] = conv["icon"]
        del conv["icon"]
        return get_json_result(data=conv)
    except Exception as e:
        return server_error_response(e)


@manager.route("/rm", methods=["POST"])  # noqa: F821
@api_key_or_login_required
def rm(**kwargs):
    conv_ids = request.json["conversation_ids"]

    # Get tenant_id based on authentication method
    auth_method = kwargs.get("auth_method")
    if auth_method == "api_key":
        tenant_id = kwargs.get("tenant_id")
    else:
        tenant_id = None

    try:
        for cid in conv_ids:
            exist, conv = ConversationService.get_by_id(cid)
            if not exist:
                return get_data_error_result(message="Conversation not found!")

            if auth_method == "api_key":
                # Verify dialog belongs to this tenant
                if not DialogService.query(tenant_id=tenant_id, id=conv.dialog_id):
                    return get_json_result(data=False, message="Only owner of conversation authorized for this operation.", code=settings.RetCode.OPERATING_ERROR)
            else:
                # Session authentication
                tenants = UserTenantService.query(user_id=current_user.id)
                for tenant in tenants:
                    if DialogService.query(tenant_id=tenant.tenant_id, id=conv.dialog_id):
                        break
                else:
                    return get_json_result(data=False, message="Only owner of conversation authorized for this operation.", code=settings.RetCode.OPERATING_ERROR)

            ConversationService.delete_by_id(cid)
        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)


@manager.route("/list", methods=["GET"])  # noqa: F821
@api_key_or_login_required
def list_conversation(**kwargs):
    dialog_id = request.args["dialog_id"]
    # Optional user_id parameter for FreeChat beta mode
    user_id = request.args.get("user_id")

    # Get tenant_id based on authentication method
    auth_method = kwargs.get("auth_method")
    if auth_method == "api_key":
        tenant_id = kwargs.get("tenant_id")
        # If user_id provided, use it; otherwise use tenant_id
        if user_id:
            tenant_id = user_id
    else:
        tenant_id = current_user.id

    try:
        if not DialogService.query(tenant_id=tenant_id, id=dialog_id):
            return get_json_result(data=False, message="Only owner of dialog authorized for this operation.", code=settings.RetCode.OPERATING_ERROR)
        
        # Query conversations ordered by update_time (most recent first)
        convs = ConversationService.query(
            dialog_id=dialog_id, 
            user_id=tenant_id,
            order_by=ConversationService.model.update_time, 
            reverse=True
        )

        # Transform to frontend-compatible session format
        # FIX: Filter out invalid conversations (must have model_card_id for FreeChat)
        sessions = []
        for conv in convs:
            conv_dict = conv.to_dict()
            
            # Skip conversations without model_card_id (old data or invalid)
            if not conv_dict.get("model_card_id"):
                logging.warning(f"[FreeChat] Skipping conversation {conv_dict['id']} without model_card_id")
                continue
            
            # Handle timestamp conversion (conv.create_time might be int or datetime)
            try:
                if hasattr(conv.create_time, 'timestamp'):
                    created_at = int(conv.create_time.timestamp() * 1000)
                else:
                    # Already a Unix timestamp (seconds)
                    created_at = int(conv.create_time * 1000) if conv.create_time else 0
            except (AttributeError, TypeError):
                created_at = 0
            
            try:
                if hasattr(conv.update_time, 'timestamp'):
                    updated_at = int(conv.update_time.timestamp() * 1000)
                else:
                    # Already a Unix timestamp (seconds)
                    updated_at = int(conv.update_time * 1000) if conv.update_time else 0
            except (AttributeError, TypeError):
                updated_at = 0
            
            # Frontend session format
            session = {
                "id": conv_dict["id"],
                "conversation_id": conv_dict["id"],
                "model_card_id": conv_dict.get("model_card_id"),
                "name": conv_dict["name"],
                "messages": conv_dict.get("message", []),
                "created_at": created_at,
                "updated_at": updated_at,
                "params": {},  # Model params stored per session
            }
            sessions.append(session)
        
        logging.info(f"[FreeChat] Loaded {len(sessions)} sessions for dialog {dialog_id}")
        return get_json_result(data=sessions)
    except Exception as e:
        return server_error_response(e)


@manager.route("/completion", methods=["POST"])  # noqa: F821
@api_key_or_login_required
@validate_request("conversation_id", "messages")
def completion(**kwargs):
    req = request.json
    msg = []
    for m in req["messages"]:
        if m["role"] == "system":
            continue
        if m["role"] == "assistant" and not msg:
            continue
        msg.append(m)
    message_id = msg[-1].get("id")
    chat_model_id = req.get("llm_id", "")
    req.pop("llm_id", None)

    # Support model card system (required parameter)
    model_card_id = req.get("model_card_id", None)
    if model_card_id is None:
        return get_data_error_result(message="model_card_id is required")
    req.pop("model_card_id", None)

    # Support dynamic knowledge base selection
    # BUG FIX: Distinguish between "not provided" and "empty array"
    kb_ids = req.get("kb_ids", None)
    req.pop("kb_ids", None)

    # Support dynamic role prompt (system prompt override)
    role_prompt = req.get("role_prompt", None)
    req.pop("role_prompt", None)

    # Collect conversation-level parameter overrides
    chat_model_config = {}
    for model_config in [
        "temperature",
        "top_p",
        "frequency_penalty",
        "presence_penalty",
        "max_tokens",
    ]:
        config = req.get(model_config)
        if config is not None:
            chat_model_config[model_config] = config

    try:
        e, conv = ConversationService.get_by_id(req["conversation_id"])
        if not e:
            return get_data_error_result(message="Conversation not found!")
        conv.message = deepcopy(req["messages"])
        # Update conversation's model_card_id
        conv.model_card_id = model_card_id
        e, dia = DialogService.get_by_id(conv.dialog_id)
        if not e:
            return get_data_error_result(message="Dialog not found!")
        del req["conversation_id"]
        del req["messages"]

        if not conv.reference:
            conv.reference = []
        conv.reference = [r for r in conv.reference if r]
        conv.reference.append({"chunks": [], "doc_aggs": []})

        # Model card parameter merging: conversation > card > bot
        # Step 1: Start with bot defaults (already in dia object)
        # Step 2: Apply model card parameters if model_card_id provided
        if model_card_id:
            # Hybrid authentication approach for model card parameter fetching
            # - API Key: uses beta_token (from Authorization header)
            # - Session: uses access_token (from current_user, already in memory)
            auth_method = kwargs.get("auth_method")
            auth_token = None

            if auth_method == "api_key":
                # API key authentication - use beta_token directly from header
                authorization_str = request.headers.get("Authorization")
                if authorization_str:
                    parts = authorization_str.split()
                    if len(parts) == 2 and parts[0] == 'Bearer':
                        auth_token = parts[1]  # beta_token
            elif auth_method == "session":
                # Session authentication - get or create beta_token for current user
                from api.db.db_models import APIToken
                from api.db.services.api_service import APITokenService
                
                tokens = APIToken.query(tenant_id=current_user.id)
                if tokens and len(tokens) > 0:
                    auth_token = tokens[0].beta
                else:
                    # Create beta_token if not exists
                    from api.utils import get_uuid
                    from api.db import current_timestamp
                    
                    beta_token = "ragflow-" + get_uuid()[:32]
                    token_obj = {
                        "tenant_id": current_user.id,
                        "token": get_uuid(),
                        "beta": beta_token,
                        "dialog_id": None,
                        "source": None,
                        "create_time": current_timestamp(),
                        "update_time": current_timestamp(),
                    }
                    APITokenService.save(**token_obj)
                    auth_token = beta_token

            if auth_token:
                model_card = fetch_model_card(model_card_id, auth_token)
                if model_card:
                    logging.info(f"[ModelCard] Applying card {model_card_id} parameters")
                    # Override dialog's bot_id if card specifies different bot
                    if model_card.get("bot_id") and model_card["bot_id"] != dia.id:
                        logging.warning(f"[ModelCard] Card bot_id {model_card['bot_id']} differs from conv dialog_id {dia.id}")
                        # Note: Not changing dialog here to maintain conversation integrity
                        # The bot_id in card is mainly for reference

                    # Apply card's parameter defaults (will be overridden by conversation params below)
                    card_llm_setting = {}
                    if "temperature" in model_card:
                        card_llm_setting["temperature"] = model_card["temperature"]
                    if "top_p" in model_card:
                        card_llm_setting["top_p"] = model_card["top_p"]

                    # Merge: start with card params
                    merged_config = card_llm_setting.copy()
                    # Override with conversation params
                    merged_config.update(chat_model_config)
                    chat_model_config = merged_config

                    # Apply card's prompt as default if no conversation-level override
                    if role_prompt is None and model_card.get("prompt"):
                        role_prompt = model_card["prompt"]
                        logging.info(f"[ModelCard] Using card prompt (length: {len(role_prompt)})")
                else:
                    logging.warning(f"[ModelCard] Failed to fetch card {model_card_id}")
            else:
                logging.warning(f"[ModelCard] No access_token available for fetching card {model_card_id}")

        # Step 3: Apply conversation-level overrides (highest priority)
        if chat_model_id:
            if not TenantLLMService.get_api_key(tenant_id=dia.tenant_id, model_name=chat_model_id):
                req.pop("chat_model_id", None)
                req.pop("chat_model_config", None)
                return get_data_error_result(message=f"Cannot use specified model {chat_model_id}.")
            dia.llm_id = chat_model_id
            dia.llm_setting = chat_model_config
        elif chat_model_config:
            # Apply merged config even without changing llm_id
            dia.llm_setting = {**dia.llm_setting, **chat_model_config}

        # Temporarily override dialog's kb_ids if provided
        # BUG FIX: Use 'is not None' to allow empty list to clear kb_ids
        logging.info(f"[FreeChat] Before override - dialog.kb_ids: {dia.kb_ids}, received kb_ids: {kb_ids}")
        if kb_ids is not None:
            logging.info(f"[FreeChat] Overriding dialog kb_ids from {dia.kb_ids} to {kb_ids}")
            dia.kb_ids = kb_ids
            logging.info(f"[FreeChat] After override - dialog.kb_ids is now: {dia.kb_ids}, type: {type(dia.kb_ids)}")
        else:
            logging.info(f"[FreeChat] Using dialog's default kb_ids: {dia.kb_ids}")

        # Temporarily override dialog's system prompt if role_prompt provided
        if role_prompt is not None and role_prompt.strip():
            logging.info(f"[FreeChat] Overriding dialog system prompt with role_prompt (length: {len(role_prompt)})")
            dia.prompt_config["system"] = role_prompt
        else:
            logging.info(f"[FreeChat] Using dialog's default system prompt")

        # Add model_card_id and parameters to req for persistence in conversation
        req["model_card_id"] = model_card_id
        req.update(chat_model_config)  # Add temperature, top_p, etc.

        is_embedded = bool(chat_model_id)
        def stream():
            nonlocal dia, msg, req, conv
            try:
                for ans in chat(dia, msg, True, **req):
                    ans = structure_answer(conv, ans, message_id, conv.id)
                    yield "data:" + json.dumps({"code": 0, "message": "", "data": ans}, ensure_ascii=False) + "\n\n"
                
                # FIX: Always persist conversation messages and metadata
                # This ensures messages are saved to Conversation.message field
                if not is_embedded:
                    update_data = {
                        "message": conv.message,
                        "reference": conv.reference,
                        "model_card_id": conv.model_card_id,
                        "message_count": len(conv.message),  # FIX: Update message count
                    }
                    ConversationService.update_by_id(conv.id, update_data)
                    logging.info(f"[FreeChat] Persisted {len(conv.message)} messages to conversation {conv.id}")
            except Exception as e:
                logging.exception(e)
                yield "data:" + json.dumps({"code": 500, "message": str(e), "data": {"answer": "**ERROR**: " + str(e), "reference": []}}, ensure_ascii=False) + "\n\n"
            yield "data:" + json.dumps({"code": 0, "message": "", "data": True}, ensure_ascii=False) + "\n\n"

        if req.get("stream", True):
            resp = Response(stream(), mimetype="text/event-stream")
            resp.headers.add_header("Cache-control", "no-cache")
            resp.headers.add_header("Connection", "keep-alive")
            resp.headers.add_header("X-Accel-Buffering", "no")
            resp.headers.add_header("Content-Type", "text/event-stream; charset=utf-8")
            return resp

        else:
            answer = None
            for ans in chat(dia, msg, **req):
                answer = structure_answer(conv, ans, message_id, conv.id)
                if not is_embedded:
                    # FIX: Explicitly persist messages and metadata
                    update_data = {
                        "message": conv.message,
                        "reference": conv.reference,
                        "model_card_id": conv.model_card_id,
                        "message_count": len(conv.message),  # FIX: Update message count
                    }
                    ConversationService.update_by_id(conv.id, update_data)
                    logging.info(f"[FreeChat] Persisted {len(conv.message)} messages to conversation {conv.id} (non-stream)")
                break
            return get_json_result(data=answer)
    except Exception as e:
        return server_error_response(e)


@manager.route("/tts", methods=["POST"])  # noqa: F821
@api_key_or_login_required
def tts(**kwargs):
    req = request.json
    text = req["text"]

    # Get tenant info based on authentication method
    auth_method = kwargs.get("auth_method")
    if auth_method == "api_key":
        tenant_id = kwargs.get("tenant_id")
        e, tenant = TenantService.get_by_id(tenant_id)
        if not e:
            return get_data_error_result(message="Tenant not found!")
        tenant_dict = tenant.to_dict()
        tts_id = tenant_dict.get("tts_id")
        tenant_id_for_llm = tenant_dict.get("id")
    else:
        tenants = TenantService.get_info_by(current_user.id)
        if not tenants:
            return get_data_error_result(message="Tenant not found!")
        tts_id = tenants[0]["tts_id"]
        tenant_id_for_llm = tenants[0]["tenant_id"]
    if not tts_id:
        return get_data_error_result(message="No default TTS model is set")

    tts_mdl = LLMBundle(tenant_id_for_llm, LLMType.TTS, tts_id)

    def stream_audio():
        try:
            for txt in re.split(r"[，。/《》？；：！\n\r:;]+", text):
                for chunk in tts_mdl.tts(txt):
                    yield chunk
        except Exception as e:
            yield ("data:" + json.dumps({"code": 500, "message": str(e), "data": {"answer": "**ERROR**: " + str(e)}}, ensure_ascii=False)).encode("utf-8")

    resp = Response(stream_audio(), mimetype="audio/mpeg")
    resp.headers.add_header("Cache-Control", "no-cache")
    resp.headers.add_header("Connection", "keep-alive")
    resp.headers.add_header("X-Accel-Buffering", "no")

    return resp


@manager.route("/delete_msg", methods=["POST"])  # noqa: F821
@api_key_or_login_required
@validate_request("conversation_id", "message_id")
def delete_msg(**kwargs):
    req = request.json
    e, conv = ConversationService.get_by_id(req["conversation_id"])
    if not e:
        return get_data_error_result(message="Conversation not found!")

    conv = conv.to_dict()
    for i, msg in enumerate(conv["message"]):
        if req["message_id"] != msg.get("id", ""):
            continue
        # BUG FIX: Check if next message exists (should be assistant's reply)
        # Original assert was checking if next message has SAME id, which is impossible
        if i + 1 >= len(conv["message"]):
            return get_data_error_result(message="Cannot delete: message has no reply!")
        # Delete user message and assistant reply
        conv["message"].pop(i)
        conv["message"].pop(i)
        # Delete corresponding reference
        ref_index = max(0, i // 2 - 1)
        if ref_index < len(conv["reference"]):
            conv["reference"].pop(ref_index)
        # FIX: Update message count after deletion
        conv["message_count"] = len(conv["message"])
        break

    ConversationService.update_by_id(conv["id"], conv)
    return get_json_result(data=conv)


@manager.route("/thumbup", methods=["POST"])  # noqa: F821
@api_key_or_login_required
@validate_request("conversation_id", "message_id")
def thumbup(**kwargs):
    req = request.json
    e, conv = ConversationService.get_by_id(req["conversation_id"])
    if not e:
        return get_data_error_result(message="Conversation not found!")
    up_down = req.get("thumbup")
    feedback = req.get("feedback", "")
    conv = conv.to_dict()
    for i, msg in enumerate(conv["message"]):
        if req["message_id"] == msg.get("id", "") and msg.get("role", "") == "assistant":
            if up_down:
                msg["thumbup"] = True
                if "feedback" in msg:
                    del msg["feedback"]
            else:
                msg["thumbup"] = False
                if feedback:
                    msg["feedback"] = feedback
            break

    ConversationService.update_by_id(conv["id"], conv)
    return get_json_result(data=conv)


@manager.route("/ask", methods=["POST"])  # noqa: F821
@api_key_or_login_required
@validate_request("question", "kb_ids")
def ask_about(**kwargs):
    req = request.json

    # Get tenant_id based on authentication method
    auth_method = kwargs.get("auth_method")
    if auth_method == "api_key":
        uid = kwargs.get("tenant_id")
    else:
        uid = current_user.id

    search_id = req.get("search_id", "")
    search_app = None
    search_config = {}
    if search_id:
        search_app = SearchService.get_detail(search_id)
    if search_app:
        search_config = search_app.get("search_config", {})

    def stream():
        nonlocal req, uid
        try:
            for ans in ask(req["question"], req["kb_ids"], uid, search_config=search_config):
                yield "data:" + json.dumps({"code": 0, "message": "", "data": ans}, ensure_ascii=False) + "\n\n"
        except Exception as e:
            yield "data:" + json.dumps({"code": 500, "message": str(e), "data": {"answer": "**ERROR**: " + str(e), "reference": []}}, ensure_ascii=False) + "\n\n"
        yield "data:" + json.dumps({"code": 0, "message": "", "data": True}, ensure_ascii=False) + "\n\n"

    resp = Response(stream(), mimetype="text/event-stream")
    resp.headers.add_header("Cache-control", "no-cache")
    resp.headers.add_header("Connection", "keep-alive")
    resp.headers.add_header("X-Accel-Buffering", "no")
    resp.headers.add_header("Content-Type", "text/event-stream; charset=utf-8")
    return resp


@manager.route("/mindmap", methods=["POST"])  # noqa: F821
@api_key_or_login_required
@validate_request("question", "kb_ids")
def mindmap(**kwargs):
    req = request.json

    # Get tenant_id based on authentication method
    auth_method = kwargs.get("auth_method")
    if auth_method == "api_key":
        tenant_id = kwargs.get("tenant_id")
    else:
        tenant_id = current_user.id

    search_id = req.get("search_id", "")
    search_app = SearchService.get_detail(search_id) if search_id else {}
    search_config = search_app.get("search_config", {}) if search_app else {}
    kb_ids = search_config.get("kb_ids", [])
    kb_ids.extend(req["kb_ids"])
    kb_ids = list(set(kb_ids))

    mind_map = gen_mindmap(req["question"], kb_ids, search_app.get("tenant_id", tenant_id), search_config)
    if "error" in mind_map:
        return server_error_response(Exception(mind_map["error"]))
    return get_json_result(data=mind_map)


@manager.route("/related_questions", methods=["POST"])  # noqa: F821
@api_key_or_login_required
@validate_request("question")
def related_questions(**kwargs):
    req = request.json

    # Get tenant_id based on authentication method
    auth_method = kwargs.get("auth_method")
    if auth_method == "api_key":
        tenant_id = kwargs.get("tenant_id")
    else:
        tenant_id = current_user.id

    search_id = req.get("search_id", "")
    search_config = {}
    if search_id:
        if search_app := SearchService.get_detail(search_id):
            search_config = search_app.get("search_config", {})

    question = req["question"]

    chat_id = search_config.get("chat_id", "")
    chat_mdl = LLMBundle(tenant_id, LLMType.CHAT, chat_id)

    gen_conf = search_config.get("llm_setting", {"temperature": 0.9})
    if "parameter" in gen_conf:
        del gen_conf["parameter"]
    prompt = load_prompt("related_question")
    ans = chat_mdl.chat(
        prompt,
        [
            {
                "role": "user",
                "content": f"""
Keywords: {question}
Related search terms:
    """,
            }
        ],
        gen_conf,
    )
    return get_json_result(data=[re.sub(r"^[0-9]\. ", "", a) for a in ans.split("\n") if re.match(r"^[0-9]\. ", a)])
