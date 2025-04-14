import * as THREE from 'three';

export class UIFloorPlanController {
    constructor(eventController) {
        // 부모 이벤트 컨트롤러 참조
        this.eventController = eventController;
        
        // 단축 참조 설정
        this.uiController = eventController.uiController;
        this.raycaster = eventController.raycaster;
        this.mouse = eventController.mouse;
        this.camera = eventController.camera;
        this.scene = eventController.scene;
        this.controls = eventController.controls;
        
        // 바닥 도형 시스템 참조 (나중에 설정됨)
        this.floorPlanSystem = null;
        
        // DOM 요소
        this.floorWidthInput = document.getElementById('floorWidth');
        this.floorDepthInput = document.getElementById('floorDepth');
        this.floorMoveToggle = document.getElementById('floorMoveToggle');
        this.floorPositionInfo = document.getElementById('floorPositionInfo');
        this.updateFloorButton = document.getElementById('updateFloorButton');
        
        // 이벤트 핸들러 바인딩
        this.handleFloorMoveToggle = this.handleFloorMoveToggle.bind(this);
        this.handleUpdateFloor = this.handleUpdateFloor.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }
    
    /**
     * 바닥 도형 시스템 설정
     */
    setFloorPlanSystem(floorPlanSystem) {
        this.floorPlanSystem = floorPlanSystem;
        
        // 초기 UI 값 설정
        if (floorPlanSystem) {
            const floorInfo = floorPlanSystem.getFloorInfo();
            
            if (this.floorWidthInput) this.floorWidthInput.value = floorInfo.width;
            if (this.floorDepthInput) this.floorDepthInput.value = floorInfo.depth;
            
            this.updatePositionInfo();
        }
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 바닥 이동 모드 토글
        if (this.floorMoveToggle) {
            this.floorMoveToggle.addEventListener('change', this.handleFloorMoveToggle);
        }
        
        // 바닥 업데이트 버튼
        if (this.updateFloorButton) {
            this.updateFloorButton.addEventListener('click', this.handleUpdateFloor);
        }
        
        // 캔버스 이벤트는 이벤트 컨트롤러에서 이미 설정되어 있음
        // 여기서는 추가적으로 필요한 이벤트만 설정
    }
    
    /**
     * 바닥 이동 모드 토글 처리
     */
    handleFloorMoveToggle(event) {
        if (!this.floorPlanSystem) return;
        
        const enabled = event.target.checked;
        this.floorPlanSystem.setMoveMode(enabled);
        
        // 이동 모드 활성화 시 OrbitControls 비활성화 (카메라 움직임 방지)
        if (this.controls) {
            // 이동 모드일 때는 카메라 컨트롤 일시적으로 비활성화
            this.controls.enabled = !enabled;
        }
        
        // 다른 컨트롤러에 알림 (예: 드래그 컨트롤러)
        this.eventController.dragController.disableDragWhileMovingFloor = enabled;
        
        // UI 스타일 업데이트
        if (this.floorMoveToggle) {
            this.floorMoveToggle.parentElement.classList.toggle('move-mode-active', enabled);
        }
        
        // 설명 업데이트
        if (enabled) {
            this.showMessage("그리드를 클릭하여 이동하세요. 바닥은 고정됩니다.");
        }
        
        console.log(`그리드 이동 모드: ${enabled ? '활성화' : '비활성화'}`);
    }
    
    /**
     * 바닥 도형 업데이트 처리
     */
    handleUpdateFloor() {
        if (!this.floorPlanSystem) return;
        
        const width = parseFloat(this.floorWidthInput.value);
        const depth = parseFloat(this.floorDepthInput.value);
        
        // 유효성 검사
        if (isNaN(width) || width <= 0 || isNaN(depth) || depth <= 0) {
            this.showError('잘못된 바닥 크기입니다. 모든 값은 양수여야 합니다.');
            return;
        }
        
        // 바닥 도형 업데이트
        this.floorPlanSystem.setFloorSize(width, depth);
        
        // 성공 메시지 표시
        this.showSuccess('바닥 도형이 업데이트되었습니다.');
    }
    
    /**
     * 마우스 다운 이벤트 처리
     */
    handleMouseDown(event) {
        if (!this.floorPlanSystem || !this.floorPlanSystem.moveMode) return false;
        
        // 마우스 좌표 정규화
        this.uiController.updateMouseCoordinates(event);
        
        // 레이캐스터 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // 바닥 도형 시스템에 이벤트 위임
        const handled = this.floorPlanSystem.handleMouseDown(this.raycaster, this.mouse);
        
        return handled;
    }
    
    /**
     * 마우스 이동 이벤트 처리
     */
    handleMouseMove(event) {
        if (!this.floorPlanSystem || !this.floorPlanSystem.moveMode) return false;
        
        // 마우스 좌표 정규화
        this.uiController.updateMouseCoordinates(event);
        
        // 레이캐스터 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // 바닥 도형 시스템에 이벤트 위임
        const handled = this.floorPlanSystem.handleMouseMove(this.raycaster);
        
        // 위치 정보 업데이트
        if (handled) {
            this.updatePositionInfo();
        }
        
        return handled;
    }
    
    /**
     * 마우스 업 이벤트 처리
     */
    handleMouseUp(event) {
        if (!this.floorPlanSystem || !this.floorPlanSystem.moveMode) return false;
        
        // 바닥 도형 시스템에 이벤트 위임
        const handled = this.floorPlanSystem.handleMouseUp();
        
        // 위치 정보 업데이트
        if (handled) {
            this.updatePositionInfo();
        }
        
        return handled;
    }
    
    /**
     * 위치 정보 업데이트
     */
    updatePositionInfo() {
        if (!this.floorPlanSystem || !this.floorPositionInfo) return;
        
        const floorInfo = this.floorPlanSystem.getFloorInfo();
        const distance = this.floorPlanSystem.calculateGridToFloorDistance().toFixed(2);
        
        this.floorPositionInfo.innerHTML = 
            `바닥 위치: X=${floorInfo.floorPosition.x}m, Z=${floorInfo.floorPosition.z}m<br>` +
            `그리드 위치: X=${floorInfo.gridPosition.x}m, Z=${floorInfo.gridPosition.z}m<br>` +
            `바닥-그리드 간격: ${distance}m`;
    }
    
    /**
     * 에러 메시지 표시
     */
    showError(message) {
        // 툴팁 컨트롤러가 있으면 위임
        if (this.uiController && this.uiController.tooltipController) {
            this.uiController.tooltipController.showErrorMessage(message);
        } else {
            // 기본 경고창
            console.error(message);
            alert(message);
        }
    }
    
    /**
     * 성공 메시지 표시
     */
    showSuccess(message) {
        // 툴팁 컨트롤러가 있으면 위임
        if (this.uiController && this.uiController.tooltipController) {
            this.uiController.tooltipController.showSuccessMessage(message);
        } else {
            console.log(message);
        }
    }
    
    /**
     * 일반 메시지 표시
     */
    showMessage(message) {
        // 툴팁 컨트롤러가 있으면 위임
        if (this.uiController && this.uiController.tooltipController) {
            this.uiController.tooltipController.showInfoMessage(message, 5000);
        } else {
            console.log(message);
        }
    }
    
    /**
     * 업데이트 (매 프레임 호출)
     */
    update() {
        // 필요하다면 여기에 프레임별 업데이트 로직 추가
        if (this.floorPlanSystem) {
            this.floorPlanSystem.update();
            
            // 드래그 중일 때 위치 정보 실시간 업데이트
            if (this.floorPlanSystem.isDragging) {
                this.updatePositionInfo();
            }
        }
    }
}