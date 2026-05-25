from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...database import get_db
from ..schemas.project import ScriptImportInput, ScriptImportPrepareResponse
from ..services.script_import_service import script_import_service
from ..utils.flow_logging import log_api_request, log_api_success

import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/{project_id}/prepare", response_model=ScriptImportPrepareResponse)
async def prepare_script_import(
    project_id: int,
    body: ScriptImportInput,
    db: Session = Depends(get_db),
):
    log_api_request(logger, "POST /script-import/{project_id}/prepare", project_id=project_id)
    result = script_import_service.prepare(db, project_id, body)
    log_api_success(
        logger,
        "POST /script-import/{project_id}/prepare",
        project_id=project_id,
        segment_count=result["segment_count"],
    )
    return ScriptImportPrepareResponse(**result)
