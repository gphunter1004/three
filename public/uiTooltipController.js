import * as THREE from 'three';

export class UITooltipController {
    constructor(uiController) {
        // 부모 UI 컨트롤러 참조
        this.uiController = uiController;
        
        // 단축 참조 설정
        this.modelManager = uiController.modelManager;
        this.raycaster = uiController.raycaster;
        this.mouse = uiController.mouse;
        this.camera = uiController.camera;
        
        // DOM 요소
        this.tooltip = document.getElementById('tooltip');
        this.gridBoundaryMessage = document.getElementById('gridBoundaryMessage');
        this.collisionMessage = document.getElementById('collisionMessage');
        
        // 메시지 타임아웃 참조
        this.messageTimeouts = {
            gridBoundary: null,
            collision: null,
            success: null,
            error: null
        };
        
        // 동적 메시지 요소 생성
        this.createDynamicMessageElements();
        
        // 툴팁 상태
        this.isDragging = false;
    }
    
    // 동적 메시지 요소 생성
    createDynamicMessageElements() {
        // 성공 메시지 요소
        this.successMessage = document.createElement('div');
        this.successMessage.id = 'successMessage';
        this.successMessage.className = 'message success-message';
        this.successMessage.style.display = 'none';
        document.body.appendChild(this.successMessage);
        
        // 에러 메시지 요소
        this.errorMessage = document.createElement('div');
        this.errorMessage.id = 'errorMessage';
        this.errorMessage.className = 'message error-message';
        this.errorMessage.style.display = 'none';
        document.body.appendChild(this.errorMessage);
        
        // 상세 정보 툴팁 요소 생성
        this.detailTooltip = document.createElement('div');
        this.detailTooltip.className = 'detail-tooltip';
        this.detailTooltip.style.display = 'none';
        document.body.appendChild(this.detailTooltip);
    }
    
    // 툴팁 위치 업데이트
    updateTooltipPosition(event) {
        if (this.isDragging) {
            // 드래그 중에는 툴팁 숨기기
            this.hideTooltip();
            return;
        }

        // 마우스 좌표 정규화
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // 레이캐스터 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // 선택 메시에 대한 레이캐스팅 수행
        const models = this.modelManager.getAllModels();
        const selectionMeshes = models.map(model => model.selectionMesh);
        const intersects = this.raycaster.intersectObjects(selectionMeshes);

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            const modelId = hitObject.userData.modelId;
            const model = this.modelManager.getModel(modelId);
            
            if (model) {
                // 툴팁 표시
                this.showTooltip(event.clientX, event.clientY, model.name);
            }
        } else {
            // 툴팁 숨기기
            this.hideTooltip();
        }
    }
    
    // 툴팁 표시
    showTooltip(x, y, text) {
        if (!this.tooltip) return;
        
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (x + 10) + 'px';
        this.tooltip.style.top = (y + 10) + 'px';
        this.tooltip.textContent = text;
    }
    
    // 툴팁 숨기기
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }
    
    // 드래그 상태 설정
    setDragging(isDragging) {
        this.isDragging = isDragging;
        if (isDragging) {
            this.hideTooltip();
        }
    }
    
    // 그리드 경계 메시지 표시
    showGridBoundaryMessage(duration = 2000) {
        if (!this.gridBoundaryMessage) return;
        
        this.gridBoundaryMessage.style.display = 'block';
        
        // 기존 타임아웃 취소
        if (this.messageTimeouts.gridBoundary) {
            clearTimeout(this.messageTimeouts.gridBoundary);
        }
        
        // 지정된 시간 후 메시지 숨기기
        this.messageTimeouts.gridBoundary = setTimeout(() => {
            this.gridBoundaryMessage.style.display = 'none';
        }, duration);
    }
    
    // 충돌 메시지 표시
    showCollisionMessage(show) {
        if (!this.collisionMessage) return;
        
        this.collisionMessage.style.display = show ? 'block' : 'none';
    }
    
    // 성공 메시지 표시
    showSuccessMessage(message, duration = 3000) {
        if (!this.successMessage) return;
        
        this.successMessage.textContent = message;
        this.successMessage.style.display = 'block';
        
        // 기존 타임아웃 취소
        if (this.messageTimeouts.success) {
            clearTimeout(this.messageTimeouts.success);
        }
        
        // 지정된 시간 후 메시지 숨기기
        this.messageTimeouts.success = setTimeout(() => {
            this.successMessage.style.opacity = '0';
            setTimeout(() => {
                this.successMessage.style.display = 'none';
                this.successMessage.style.opacity = '1';
            }, 300);
        }, duration);
    }
    
    // 에러 메시지 표시
    showErrorMessage(message, duration = 4000) {
        if (!this.errorMessage) return;
        
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        
        // 기존 타임아웃 취소
        if (this.messageTimeouts.error) {
            clearTimeout(this.messageTimeouts.error);
        }
        
        // 지정된 시간 후 메시지 숨기기
        this.messageTimeouts.error = setTimeout(() => {
            this.errorMessage.style.opacity = '0';
            setTimeout(() => {
                this.errorMessage.style.display = 'none';
                this.errorMessage.style.opacity = '1';
            }, 300);
        }, duration);
    }
    
    // 모든 메시지 숨기기
    hideAllMessages() {
        // 모든 타임아웃 취소
        Object.values(this.messageTimeouts).forEach(timeout => {
            if (timeout) clearTimeout(timeout);
        });
        
        // 모든 메시지 숨기기
        if (this.gridBoundaryMessage) this.gridBoundaryMessage.style.display = 'none';
        if (this.collisionMessage) this.collisionMessage.style.display = 'none';
        if (this.successMessage) this.successMessage.style.display = 'none';
        if (this.errorMessage) this.errorMessage.style.display = 'none';
    }
    
    // 상세 정보 툴팁 표시 (마우스 오버 시 추가 정보)
    showDetailTooltip(event, title, details) {
        // 기존 툴팁을 숨기고 상세 정보 툴팁 생성
        this.hideTooltip();
        
        // 내용 업데이트
        this.detailTooltip.innerHTML = `
            <div class="detail-tooltip-title">${title}</div>
            <div class="detail-tooltip-content">${details}</div>
        `;
        
        // 위치 설정
        this.detailTooltip.style.left = (event.clientX + 15) + 'px';
        this.detailTooltip.style.top = (event.clientY + 15) + 'px';
        this.detailTooltip.style.display = 'block';
    }
    
    // 상세 정보 툴팁 숨기기
    hideDetailTooltip() {
        if (this.detailTooltip) {
            this.detailTooltip.style.display = 'none';
        }
    }
    
    // 업데이트 (매 프레임 호출)
    update() {
        // 필요한 경우 여기에 프레임별 업데이트 로직 추가
    }
}