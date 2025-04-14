import * as THREE from 'three';

export class UIGridSettingsController {
    constructor(uiController) {
        // 부모 UI 컨트롤러 참조
        this.uiController = uiController;
        
        // 단축 참조 설정
        this.modelManager = uiController.modelManager;
        this.gridSystem = uiController.gridSystem;
        this.camera = uiController.camera; // 카메라 참조 추가
        
        // DOM 요소
        this.mapResolutionInput = document.getElementById('mapResolution');
        this.gridCellWidthInput = document.getElementById('gridCellWidth');
        this.gridCellDepthInput = document.getElementById('gridCellDepth');
        this.gridWidthCountInput = document.getElementById('gridWidthCount');
        this.gridDepthCountInput = document.getElementById('gridDepthCount');
        this.updateGridButton = document.getElementById('updateGridButton');
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 그리드 업데이트 버튼
        if (this.updateGridButton) {
            this.updateGridButton.addEventListener('click', this.handleUpdateGrid.bind(this));
        }
        
        // 배율 입력 변경 시 실시간 업데이트
        if (this.mapResolutionInput) {
            this.mapResolutionInput.addEventListener('input', this.handleInputChange.bind(this));
        }
        
        // 그리드 셀 크기 입력 변경 시 실시간 업데이트
        if (this.gridCellWidthInput) {
            this.gridCellWidthInput.addEventListener('input', this.handleInputChange.bind(this));
        }
        
        if (this.gridCellDepthInput) {
            this.gridCellDepthInput.addEventListener('input', this.handleInputChange.bind(this));
        }
        
        // 그리드 셀 수 입력 변경 시도 업데이트
        if (this.gridWidthCountInput) {
            this.gridWidthCountInput.addEventListener('input', this.handleInputChange.bind(this));
        }
        
        if (this.gridDepthCountInput) {
            this.gridDepthCountInput.addEventListener('input', this.handleInputChange.bind(this));
        }
    }
    
    // 그리드 설정 UI 초기화
    initializeGridSettingsUI() {
        if (this.gridSystem) {
            const settings = this.gridSystem.getGridSettings();
            
            // null 체크 추가
            if (this.mapResolutionInput) this.mapResolutionInput.value = settings.mapResolution;
            if (this.gridCellWidthInput) this.gridCellWidthInput.value = settings.gridCellWidth;
            if (this.gridCellDepthInput) this.gridCellDepthInput.value = settings.gridCellDepth;
            if (this.gridWidthCountInput) this.gridWidthCountInput.value = settings.gridWidthCount;
            if (this.gridDepthCountInput) this.gridDepthCountInput.value = settings.gridDepthCount;
            
            // 정보 텍스트 업데이트 (픽셀당 cm 표시)
            this.updateResolutionInfo(settings.mapResolution);
            
            // 픽셀 정보 업데이트
            this.updatePixelInfo();
        }
    }
    
    // 픽셀당 cm 정보 업데이트
    updateResolutionInfo(resolution) {
        const infoElement = document.querySelector('.setting-info');
        if (infoElement && resolution) {
            const cmPerPixel = resolution * 100; // 미터를 센티미터로 변환
            infoElement.textContent = `(1픽셀 = ${cmPerPixel.toFixed(1)}cm)`;
        }
    }
    
    // 입력 변경 통합 핸들러
    handleInputChange(event) {
        // 배율 변경인 경우 해상도 정보 업데이트
        if (event.target === this.mapResolutionInput) {
            const newResolution = parseFloat(event.target.value);
            if (!isNaN(newResolution) && newResolution > 0) {
                this.updateResolutionInfo(newResolution);
            }
        }
        
        // 임시 설정 객체 생성 (현재 입력값 기준)
        if (this.gridSystem) {
            const currentSettings = this.gridSystem.getGridSettings();
            const tempSettings = { ...currentSettings };
            
            // 현재 입력값으로 임시 설정 업데이트
            const mapResolution = parseFloat(this.mapResolutionInput?.value) || currentSettings.mapResolution;
            const gridCellWidth = parseFloat(this.gridCellWidthInput?.value) || currentSettings.gridCellWidth;
            const gridCellDepth = parseFloat(this.gridCellDepthInput?.value) || currentSettings.gridCellDepth;
            const gridWidthCount = parseInt(this.gridWidthCountInput?.value) || currentSettings.gridWidthCount;
            const gridDepthCount = parseInt(this.gridDepthCountInput?.value) || currentSettings.gridDepthCount;
            
            // 유효한 값만 적용
            if (mapResolution > 0) tempSettings.mapResolution = mapResolution;
            if (gridCellWidth > 0) tempSettings.gridCellWidth = gridCellWidth;
            if (gridCellDepth > 0) tempSettings.gridCellDepth = gridCellDepth;
            if (gridWidthCount > 0) tempSettings.gridWidthCount = gridWidthCount;
            if (gridDepthCount > 0) tempSettings.gridDepthCount = gridDepthCount;
            
            // 임시 설정으로 정보만 업데이트 (실제 그리드는 변경하지 않음)
            const originalSettings = { ...this.gridSystem.gridSettings };
            this.gridSystem.gridSettings = tempSettings;
            this.updatePixelInfo();
            this.gridSystem.gridSettings = originalSettings;
        }
    }
    
    // 그리드 픽셀 정보 업데이트 메서드
    updatePixelInfo() {
        // 픽셀 정보 요소 찾기
        const pixelInfoElement = document.getElementById('gridPixelInfo');
        if (!pixelInfoElement || !this.gridSystem) return;
        
        // 그리드 시스템의 픽셀 크기 계산 메서드 사용
        const pixelInfo = this.gridSystem.calculatePixelDimensions();
        
        // 호환성 정보 계산
        let compatibilityMsg = '';
        
        if (pixelInfo.isLarge) {
            compatibilityMsg = ' <span class="warning-icon">⚠️</span> 대형 맵';
        }
        
        // 셀의 미터 크기를 cm로 변환하여 표시
        const cellWidthCm = (pixelInfo.cellWidthMeters * 100).toFixed(1);
        const cellDepthCm = (pixelInfo.cellDepthMeters * 100).toFixed(1);
        
        // 정보 메시지 구성 - 스타일 클래스 추가
        const cellInfoText = `<span class="cell-info">셀 크기: ${pixelInfo.cellWidth}×${pixelInfo.cellHeight}px (${cellWidthCm}×${cellDepthCm}cm)</span>`;
        const mapInfoText = `<span class="map-info">전체 맵: ${pixelInfo.totalWidth}×${pixelInfo.totalHeight}px${compatibilityMsg}</span>`;
        
        // 픽셀 정보 포맷팅 및 표시
        pixelInfoElement.innerHTML = `${cellInfoText}<br>${mapInfoText}`;
        
        // 크기가 너무 크면 경고 스타일 적용
        if (pixelInfo.isLarge) {
            pixelInfoElement.classList.add('warning');
        } else {
            pixelInfoElement.classList.remove('warning');
        }
    }
    
    // 그리드 업데이트 처리
    handleUpdateGrid() {
        // null 체크 추가
        if (!this.mapResolutionInput || !this.gridCellWidthInput || 
            !this.gridCellDepthInput || !this.gridWidthCountInput || 
            !this.gridDepthCountInput) {
            this.showError('UI 요소를 찾을 수 없습니다.');
            return;
        }
        
        const mapResolution = parseFloat(this.mapResolutionInput.value);
        const gridCellWidth = parseFloat(this.gridCellWidthInput.value);
        const gridCellDepth = parseFloat(this.gridCellDepthInput.value);
        const gridWidthCount = parseInt(this.gridWidthCountInput.value);
        const gridDepthCount = parseInt(this.gridDepthCountInput.value);
        
        // 유효성 검사
        if (isNaN(mapResolution) || mapResolution <= 0 ||
            isNaN(gridCellWidth) || gridCellWidth <= 0 ||
            isNaN(gridCellDepth) || gridCellDepth <= 0 ||
            isNaN(gridWidthCount) || gridWidthCount < 1 ||
            isNaN(gridDepthCount) || gridDepthCount < 1) {
            this.showError('잘못된 그리드 설정입니다. 모든 값은 양수여야 합니다.');
            return;
        }
        
        // 그리드 업데이트
        if (this.gridSystem) {
            this.gridSystem.updateGrid({
                mapResolution,
                gridCellWidth,
                gridCellDepth,
                gridWidthCount,
                gridDepthCount
            });
            
            // 픽셀당 cm 정보 업데이트
            this.updateResolutionInfo(mapResolution);
            
            // 픽셀 정보 업데이트
            this.updatePixelInfo();
        } else {
            this.showError('그리드 시스템을 찾을 수 없습니다.');
            return;
        }
        
        // 기존 모델들의 위치 검증 및 필요시 조정
        if (this.modelManager) {
            this.modelManager.validateAllModelsPosition();
            
            // 선택된 모델이 있으면 위치 UI 업데이트
            this.modelManager.updateSelectedModelPositionUI();
        }
        
        // 모델 패널 UI 전체 업데이트
        if (this.uiController) {
            this.uiController.updateModelList();
        }
        
        // 카메라 위치 조정 (그리드 크기 변경 시 자동으로 뷰를 조정)
        if (this.camera) {
            // 전체 그리드 크기 계산
            const totalGridSize = this.gridSystem.getTotalGridSize();
            const maxGridSize = Math.max(totalGridSize.width, totalGridSize.depth);
            
            // 그리드 크기를 고려한 적절한 카메라 거리 계산
            const cameraDistance = maxGridSize * 1.2; // 그리드보다 20% 더 멀리 위치
            
            // 카메라 위치 조정
            this.camera.position.set(0, maxGridSize * 0.5, cameraDistance);
            this.camera.lookAt(0, 0, 0);
        }
        
        // 업데이트 성공 메시지 표시
        this.showSuccess('그리드 설정이 성공적으로 업데이트되었습니다.');
    }
    
    // 에러 메시지 표시
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
    
    // 성공 메시지 표시
    showSuccess(message) {
        // 툴팁 컨트롤러가 있으면 위임
        if (this.uiController && this.uiController.tooltipController) {
            this.uiController.tooltipController.showSuccessMessage(message);
        } else {
            console.log(message);
        }
    }
    
    // 그리드 바운더리 표시 토글
    toggleBoundaryVisibility(visible) {
        if (this.gridSystem) {
            this.gridSystem.toggleBoundaryBox(visible);
        }
    }
    
    // 현재 그리드 설정 가져오기
    getCurrentGridSettings() {
        if (this.gridSystem) {
            return this.gridSystem.getGridSettings();
        }
        return null;
    }
    
    // 그리드 배율 가져오기
    getCurrentMapResolution() {
        if (this.gridSystem) {
            return this.gridSystem.getGridSettings().mapResolution;
        }
        return 0.05; // 기본값
    }
    
    // 그리드 전체 크기 가져오기
    getCurrentGridSize() {
        if (this.gridSystem) {
            return this.gridSystem.getTotalGridSize();
        }
        return { width: 10, depth: 10 }; // 기본값
    }
}