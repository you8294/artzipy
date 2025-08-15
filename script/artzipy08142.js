/*************************************************
 * 아트지피 홈페이지 JavaScript - 스택 슬라이더 통합버전 + 로딩 최적화
 * 주요 기능:
 * - 네비게이션 스무스 스크롤 & 활성 메뉴
 * - 메인 배너 슬라이더 (텍스트 동기화) + 지연 로딩
 * - 이달의 작가 스택 슬라이더 + 지연 로딩
 * - 시설안내 자동 이미지 슬라이더 + 스크롤 애니메이션 (반복 실행) + 지연 로딩
 * - 뉴스레터/상품 슬라이더
 * - 로고 클릭 모달
 * - IntersectionObserver를 통한 지연 로딩 최적화
 * - 개선된 스크롤 애니메이션 (빠른 트리거)
 *************************************************/

(function() {
  'use strict';

  // ========== DOM 요소 캐싱 ==========
  let domCache = {};
  let cleanupFunctions = [];

  function cacheDOMElements() {
    try {
      domCache = {
        navLinks: document.querySelectorAll('.nav a[href^="#"]'),
        
        banner: document.getElementById('main_banner'),
        bannerContent: null,
        bannerSlides: null,
        bannerDots: null,
        bannerPrevBtn: null,
        bannerNextBtn: null,
        
        logoSection: document.getElementById('logoSection'),
        logoModal: document.getElementById('logoModal'),
        modalImage: null,
        body: document.body,
        
        // 스택 슬라이더 요소들
        artistSliderContainer: document.getElementById('artistSliderContainer'),
        artistCards: null,
        
        sliderContainers: document.querySelectorAll('[data-slider]'),
        
        animateElements: document.querySelectorAll('.animate-slide-left, .animate-slide-right'),
        
        // 지연 로딩 대상 요소들
        featureCards: document.querySelectorAll('.feature_card[data-bg]'),
        artistCardsLazy: document.querySelectorAll('.artist_card[data-bg]'),
        lazyImages: document.querySelectorAll('img[data-src]')
      };

      if (domCache.banner) {
        domCache.bannerContent = domCache.banner.querySelector('.banner_content');
        domCache.bannerSlides = domCache.banner.querySelector('.banner_slides');
        domCache.bannerDots = domCache.banner.querySelector('.banner_dots');
        domCache.bannerPrevBtn = domCache.banner.querySelector('.banner_arrow.prev');
        domCache.bannerNextBtn = domCache.banner.querySelector('.banner_arrow.next');
      }

      if (domCache.logoModal) {
        domCache.modalImage = domCache.logoModal.querySelector('.logo-modal-image');
      }

      if (domCache.artistSliderContainer) {
        domCache.artistCards = domCache.artistSliderContainer.querySelectorAll('.artist_card');
      }
      
    } catch (error) {
      console.warn('DOM 요소 캐싱 중 오류:', error);
    }
  }

  // ========== 유틸리티 함수 ==========
  
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  function safeQuerySelector(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (error) {
      console.warn(`Invalid selector: ${selector}`, error);
      return null;
    }
  }

  function addSafeEventListener(element, event, handler, options = {}) {
    if (!element || typeof handler !== 'function') {
      console.warn('Invalid element or handler for event listener');
      return;
    }
    
    element.addEventListener(event, handler, options);
    
    cleanupFunctions.push(() => {
      element.removeEventListener(event, handler, options);
    });
  }

  // ========== IntersectionObserver 기반 지연 로딩 모듈 ==========
  const LazyLoader = {
    imageObserver: null,
    backgroundObserver: null,
    viewportObserver: null,

    init() {
      this.setupImageObserver();
      this.setupBackgroundObserver();
      this.setupViewportObserver();
    },

    setupImageObserver() {
      this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.getAttribute('data-src');
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              img.classList.add('loaded');
              this.imageObserver.unobserve(img);
            }
          }
        });
      }, {
        rootMargin: '50px 0px'
      });

      // data-src 속성을 가진 이미지들 관찰
      domCache.lazyImages.forEach(img => {
        this.imageObserver.observe(img);
      });
    },

    setupBackgroundObserver() {
      this.backgroundObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target;
            const bgUrl = element.getAttribute('data-bg');
            if (bgUrl) {
              // 플랫폼 기능 카드 배경 처리
              if (element.classList.contains('feature_card')) {
                const bgElement = element.querySelector('.feature_bg');
                if (bgElement) {
                  bgElement.style.backgroundImage = `url('${bgUrl}')`;
                  element.removeAttribute('data-bg');
                  this.backgroundObserver.unobserve(element);
                }
              }
              // 작가 카드 배경 처리
              else if (element.classList.contains('artist_card')) {
                element.style.backgroundImage = `url('${bgUrl}')`;
                element.removeAttribute('data-bg');
                this.backgroundObserver.unobserve(element);
              }
            }
          }
        });
      }, {
        rootMargin: '100px 0px'
      });

      // 배경 이미지가 필요한 요소들 관찰
      domCache.featureCards.forEach(card => {
        this.backgroundObserver.observe(card);
      });
      
      domCache.artistCardsLazy.forEach(card => {
        this.backgroundObserver.observe(card);
      });
    },

    setupViewportObserver() {
      this.viewportObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const element = entry.target;
          
          // 시설안내 슬라이더 시작/정지
          if (element.hasAttribute('data-slider')) {
            const sliderId = element.getAttribute('data-slider');
            const sliderInstance = window.debugArtzipy?.sliderInstances?.find(s => 
              s.container?.hasAttribute('data-slider') && 
              s.container.getAttribute('data-slider') === sliderId
            );
            
            if (sliderInstance) {
              if (entry.isIntersecting) {
                sliderInstance.startAutoPlay();
              } else {
                sliderInstance.stopAutoPlay();
              }
            }
          }
          
          // 작가 스택 슬라이더 시작/정지
          if (element.id === 'artistSliderContainer') {
            if (entry.isIntersecting) {
              ArtistStackSlider.startAutoSlide();
            } else {
              ArtistStackSlider.stopAutoSlide();
            }
          }
        });
      }, {
        rootMargin: '600px 0px',  // 뷰포트 상하를 확장 → 더 일찍 인식
        threshold: 0.05 // 요소가 5%만 보여도 트리거
      });

      // 뷰포트 관찰 대상 등록
      domCache.sliderContainers.forEach(container => {
        this.viewportObserver.observe(container);
      });
      
      if (domCache.artistSliderContainer) {
        this.viewportObserver.observe(domCache.artistSliderContainer);
      }
    },

    destroy() {
      if (this.imageObserver) {
        this.imageObserver.disconnect();
      }
      if (this.backgroundObserver) {
        this.backgroundObserver.disconnect();
      }
      if (this.viewportObserver) {
        this.viewportObserver.disconnect();
      }
    }
  };

  // ========== 네비게이션 모듈 ==========
  const Navigation = {
    init() {
      this.bindEvents();
      this.initScrollSpy();
    },

    bindEvents() {
      domCache.navLinks.forEach(anchor => {
        addSafeEventListener(anchor, 'click', this.handleNavClick.bind(this));
      });

      const throttledScroll = throttle(this.handleScroll.bind(this), 100);
      addSafeEventListener(window, 'scroll', throttledScroll);
    },

    handleNavClick(e) {
      e.preventDefault();
      const targetId = e.currentTarget.getAttribute('href');
      const targetElement = safeQuerySelector(targetId);
      
      if (!targetElement) {
        console.warn(`Target element not found: ${targetId}`);
        return;
      }

      this.smoothScrollTo(targetElement);
      this.updateActiveMenu(e.currentTarget);
    },

    smoothScrollTo(element) {
      const elementTop = element.offsetTop;
      const scrollPosition = elementTop - 40 - 20;

      window.scrollTo({ 
        top: Math.max(0, scrollPosition),
        behavior: 'smooth' 
      });
    },

    updateActiveMenu(activeLink) {
      domCache.navLinks.forEach(link => link.classList.remove('on'));
      activeLink.classList.add('on');
    },

    handleScroll() {
      const scrollPosition = window.scrollY + 60 + 20;
      const sections = [
        'platform_features', 'exhibition', 'artist', 'artwork_gallery', 
        'features_group_bg1', 'newsletter', 'products'
      ];

      sections.forEach(sectionId => {
        const section = safeQuerySelector(`#${sectionId}`);
        if (!section) return;

        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;

        if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
          const correspondingLink = safeQuerySelector(`.nav a[href="#${sectionId}"]`);
          if (correspondingLink) {
            this.updateActiveMenu(correspondingLink);
          }
        }
      });
    },

    initScrollSpy() {
      this.handleScroll();
    }
  };

  // === 브라우저 idle 콜백 폴리필 (지원 안 하는 환경 대비) ===
window.requestIdleCallback = window.requestIdleCallback || function (cb) {
  const start = Date.now();
  return setTimeout(() => cb({
    didTimeout: false,
    timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
  }), 1);
};
window.cancelIdleCallback = window.cancelIdleCallback || function (id) { clearTimeout(id); };

// ========== 배너 슬라이더 모듈 (지연 로딩 최적화) ==========
const BannerSlider = {
  currentIndex: 0,
  slides: [],
  dots: [],
  timer: null,
  isPlaying: true,
  isUserPaused: false,

  bannerTexts: [
    { title: 'Artzipy',        subtitle: 'Artistic Vision', description: '창작부터 판매까지, 모든 것이 하나의 플랫폼에서 이루어지는 아트공간' },
    { title: 'Creative Space', subtitle: 'Inspired',        description: '창작부터 판매까지, 모든 것이 하나의 플랫폼에서 이루어지는 아트공간' },
    { title: 'Smart Archive',  subtitle: 'Secured',         description: '창작부터 판매까지, 모든 것이 하나의 플랫폼에서 이루어지는 아트공간' },
    { title: 'Gallery',        subtitle: 'Curated',         description: '창작부터 판매까지, 모든 것이 하나의 플랫폼에서 이루어지는 아트공간' },
    { title: 'Art Commerce',   subtitle: 'Simplified',      description: '창작부터 판매까지, 모든 것이 하나의 플랫폼에서 이루어지는 아트공간' }
  ],

  defaultBannerImages: ['b1.wedp', 'b2.wedp', 'b3.wedp', 'b4.wedp', 'b5.wedp'],

  init() {
    if (!domCache.banner) {
      console.warn('Banner element not found');
      return;
    }

    this.setupSlides();
    this.createDots();
    this.bindEvents();

    // 최초 1장만 즉시 로드
    this.loadSlide(0);

    // 자동 재생 시작
    this.start();

    // 유휴 시간에 다음 장 프리페치
    this.prefetchNext();
  },

  setupSlides() {
    this.slides = Array.from(domCache.banner.querySelectorAll('.banner_slide'));

    // 기존 코드: 모든 슬라이드에 즉시 backgroundImage 지정 (→ 초기 대용량 다운로드)
    // 개선: 여기서는 아무 것도 로드하지 않고, 실제 필요 시 loadSlide에서 처리

    if (this.slides.length === 0) {
      this.createDefaultSlides();
      this.slides = Array.from(domCache.banner.querySelectorAll('.banner_slide'));
    }

    if (this.slides.length > 0) {
      this.slides[0].classList.add('active');
    }
  },

  // 특정 인덱스의 슬라이드를 "필요할 때" 로드
  loadSlide(index) {
    const slide = this.slides[index];
    if (!slide || slide.dataset.loaded === 'true') return;

    const bgImage = slide.getAttribute('data-bg');
    if (bgImage) {
      slide.style.backgroundImage = `url('${bgImage}')`;
      slide.dataset.loaded = 'true';
    }
  },

  // 다음 슬라이드를 유휴 시간에 미리 로드
  prefetchNext() {
    if (this.slides.length <= 1) return;
    const nextIndex = (this.currentIndex + 1) % this.slides.length;
    requestIdleCallback(() => this.loadSlide(nextIndex));
  },

  createDefaultSlides() {
    let slidesWrap = domCache.bannerSlides;
    if (!slidesWrap) {
      slidesWrap = document.createElement('div');
      slidesWrap.className = 'banner_slides';
      domCache.banner.appendChild(slidesWrap);
      domCache.bannerSlides = slidesWrap;
    }

    // 즉시 backgroundImage를 넣지 않고 data-bg로만 지정하여 지연 로딩 구조 유지
    this.defaultBannerImages.forEach((name, index) => {
      const div = document.createElement('div');
      div.className = 'banner_slide';
      if (index === 0) div.classList.add('active');
      div.setAttribute('data-bg', `./images/${name}`);
      slidesWrap.appendChild(div);
    });
  },

  createDots() {
    if (!domCache.bannerDots) {
      domCache.bannerDots = document.createElement('div');
      domCache.bannerDots.className = 'banner_dots';
      domCache.banner.appendChild(domCache.bannerDots);
    }

    domCache.bannerDots.innerHTML = '';

    this.slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', `${i + 1}번 슬라이드로 이동`);
      domCache.bannerDots.appendChild(dot);
    });

    this.dots = Array.from(domCache.bannerDots.querySelectorAll('.dot'));

    if (this.dots.length > 0) {
      this.dots[0].classList.add('active');
    }
  },

  bindEvents() {
    if (domCache.bannerPrevBtn) {
      addSafeEventListener(domCache.bannerPrevBtn, 'click', (e) => {
        e.stopPropagation();
        this.prevSlide();
        this.restartIfPlaying();
      });
    }

    if (domCache.bannerNextBtn) {
      addSafeEventListener(domCache.bannerNextBtn, 'click', (e) => {
        e.stopPropagation();
        this.nextSlide();
        this.restartIfPlaying();
      });
    }

    this.dots.forEach((dot, i) => {
      addSafeEventListener(dot, 'click', (e) => {
        e.stopPropagation();
        this.goToSlide(i);
        this.restartIfPlaying();
      });
    });

    addSafeEventListener(domCache.banner, 'click', (e) => {
      if (e.target.closest('.banner_arrow') || e.target.closest('.banner_dots')) return;
      this.togglePlay();
    });

    const handleVisibilityChange = () => {
      if (document.hidden) this.stop();
      else if (!this.isUserPaused) this.start();
    };
    addSafeEventListener(document, 'visibilitychange', handleVisibilityChange);

    addSafeEventListener(domCache.banner, 'keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.prevSlide();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.nextSlide();
          break;
        case ' ':
          e.preventDefault();
          this.togglePlay();
          break;
      }
    });
  },

  updateBannerText(index) {
    if (!domCache.bannerContent) return;

    const titleEl = domCache.bannerContent.querySelector('.banner_title');
    const subtitleEl = domCache.bannerContent.querySelector('.banner_subtitle');
    const descEl = domCache.bannerContent.querySelector('.banner_description');
    if (!titleEl || !subtitleEl || !descEl) return;

    const data = this.bannerTexts[index] || this.bannerTexts[0];
    if (!data) return;

    domCache.bannerContent.classList.add('fade-out');

    setTimeout(() => {
      titleEl.textContent = data.title;
      subtitleEl.textContent = data.subtitle;
      descEl.textContent = data.description;
      domCache.bannerContent.classList.remove('fade-out');
    }, 250);
  },

  goToSlide(index) {
    if (index < 0 || index >= this.slides.length) return;

    // 이동 대상 먼저 로드
    this.loadSlide(index);

    this.slides[this.currentIndex]?.classList.remove('active');
    this.dots[this.currentIndex]?.classList.remove('active');

    this.currentIndex = index;
    this.slides[this.currentIndex]?.classList.add('active');
    this.dots[this.currentIndex]?.classList.add('active');

    this.updateBannerText(this.currentIndex);

    // 다음 장 프리페치
    this.prefetchNext();
  },

  nextSlide() {
    const nextIndex = (this.currentIndex + 1) % this.slides.length;
    this.goToSlide(nextIndex);
  },

  prevSlide() {
    const prevIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.goToSlide(prevIndex);
  },

  start() {
    this.stop();
    if (this.slides.length <= 1) return;

    this.timer = setInterval(() => {
      this.nextSlide();
    }, 3000);

    this.isPlaying = true;
    domCache.banner?.classList.remove('paused');
  },

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isPlaying = false;
    domCache.banner?.classList.add('paused');
  },

  togglePlay() {
    if (this.isPlaying) {
      this.stop();
      this.isUserPaused = true;
      domCache.banner?.classList.add('user-paused');
    } else {
      this.start();
      this.isUserPaused = false;
      domCache.banner?.classList.remove('user-paused');
    }
  },

  restartIfPlaying() {
    if (this.isPlaying && !this.isUserPaused) {
      this.start();
    }
  },

  destroy() {
    this.stop();
  }
};


  // ========== 이달의 작가 스택 슬라이더 모듈 (지연 로딩 최적화) ==========
const ArtistStackSlider = {
  cardElements: null,
  totalCards: 0,
  slideInterval: null,
  isAnimating: false,

  // 현재 카드의 "원래 인덱스" 배열 (초기 0~4)
  cardOrder: [0, 1, 2, 3, 4],

  // 위치를 나타내는 클래스(0이 '가운데' 카드)
  positionClasses: [
    'artist_position_0', // 가운데
    'artist_position_1', // 오른쪽1
    'artist_position_2', // 오른쪽2
    'artist_position_3', // 왼쪽1
    'artist_position_4'  // 왼쪽2
  ],

  // ===== 설정(원하는 값으로 조절) =====
  SLIDE_INTERVAL_MS: 1300,  // 자동 넘김 간격: 1.3초
  TRANSITION_MS: 800,       // 카드 이동 애니메이션 시간(ms) ─ CSS의 0.8s와 동일해야 함
  // ==================================

  init() {
    if (!domCache.artistSliderContainer || !domCache.artistCards) {
      console.warn('Artist slider elements not found');
      return;
    }

    this.cardElements = domCache.artistCards;
    this.totalCards = this.cardElements.length;

    if (this.totalCards === 0) {
      console.warn('No artist cards found');
      return;
    }

    this.initializeCards();
    this.bindEvents();
    this.bindHoverDimEvents();   // ← 가운데 카드 hover 시 dim 처리
    // 자동 슬라이드는 뷰포트 진입 시에만 시작하도록 변경
  },

  initializeCards() {
    this.cardElements.forEach((card, index) => {
      // 초기 위치 클래스 적용
      card.classList.add(this.positionClasses[index]);
      card.setAttribute('data-card-index', index); // 원본 고정 인덱스
      card.classList.remove('dimmed');             // 안전: 초기화 시 dim 제거
      card.classList.remove('transitioning');      // 안전: 초기화 시 전환 상태 제거
    });
  },

  // 현재 가운데 카드의 "원본 인덱스" 구하기
  getCenterCardIndex() {
    // cardOrder[0]이 현재 '가운데(artist_position_0)'에 온 카드의 원본 인덱스
    return this.cardOrder[0];
  },

  updateCardPositions() {
    // 위치 업데이트 전에 안전하게 dim 제거(슬라이드 중 잔상 방지)
    this.clearDim();

    this.cardOrder.forEach((cardIndex, position) => {
      const card = this.cardElements[cardIndex];

      // 기존 위치 클래스 모두 제거
      this.positionClasses.forEach(cls => card.classList.remove(cls));

      // 새로운 위치 클래스 적용
      card.classList.add(this.positionClasses[position]);
    });
  },

  moveToNextSlide() {
    if (this.isAnimating) return;

    this.isAnimating = true;

    // 모든 카드에 트랜지션 클래스 추가
    this.cardElements.forEach(card => {
      card.classList.add('transitioning');
    });

    // 새 순서: 왼쪽1(position_3)이 가운데로 이동
    const newOrder = [
      this.cardOrder[3], // 왼쪽1 → 가운데
      this.cardOrder[0], // 가운데 → 오른쪽1
      this.cardOrder[1], // 오른쪽1 → 오른쪽2
      this.cardOrder[4], // 왼쪽2 → 왼쪽1
      this.cardOrder[2]  // 오른쪽2 → 왼쪽2
    ];

    this.cardOrder = newOrder;

    // 카드 위치 업데이트
    this.updateCardPositions();

    // 애니메이션 완료 후 트랜지션 클래스 제거
    setTimeout(() => {
      this.cardElements.forEach(card => {
        card.classList.remove('transitioning');
      });
      this.isAnimating = false;
    }, this.TRANSITION_MS);
  },

  moveToPrevSlide() {
    if (this.isAnimating) return;

    this.isAnimating = true;

    // 모든 카드에 트랜지션 클래스 추가
    this.cardElements.forEach(card => {
      card.classList.add('transitioning');
    });

    // 새 순서: 오른쪽1(position_1)이 가운데로 이동
    const newOrder = [
      this.cardOrder[1], // 오른쪽1 → 가운데
      this.cardOrder[2], // 오른쪽2 → 오른쪽1
      this.cardOrder[3], // 왼쪽1 → 오른쪽2
      this.cardOrder[4], // 왼쪽2 → 왼쪽1
      this.cardOrder[0]  // 가운데 → 왼쪽2
    ];

    this.cardOrder = newOrder;

    // 카드 위치 업데이트
    this.updateCardPositions();

    // 애니메이션 완료 후 트랜지션 클래스 제거
    setTimeout(() => {
      this.cardElements.forEach(card => {
        card.classList.remove('transitioning');
      });
      this.isAnimating = false;
    }, this.TRANSITION_MS); // ← 이전(600ms)과 달리 800ms로 통일
  },

  // 자동 넘김 시작
  startAutoSlide() {
    this.stopAutoSlide();
    this.slideInterval = setInterval(() => {
      this.moveToNextSlide();
    }, this.SLIDE_INTERVAL_MS); // 1300ms
  },

  // 자동 넘김 정지
  stopAutoSlide() {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
      this.slideInterval = null;
    }
  },

  // 가운데 카드 hover 시 나머지 카드 dim 처리
  bindHoverDimEvents() {
    // 카드 각각에 hover 이벤트 등록
    this.cardElements.forEach(card => {
      card.addEventListener('mouseenter', () => {
        const centerIndex = this.getCenterCardIndex();                 // 현재 '가운데'에 온 카드의 원본 인덱스
        const hoveredIndex = parseInt(card.dataset.cardIndex, 10);     // 이 카드의 원본 인덱스

        // 가운데 카드에만 dim 처리 실행
        if (hoveredIndex === centerIndex) {
          this.cardElements.forEach((c, idx) => {
            if (idx !== hoveredIndex) c.classList.add('dimmed');
          });
        }
      });

      card.addEventListener('mouseleave', () => {
        this.clearDim();
      });
    });
  },

  // dim 클래스 제거(슬라이드/마우스 아웃 시 공통)
  clearDim() {
    this.cardElements.forEach(c => c.classList.remove('dimmed'));
  },

  bindEvents() {
    // 슬라이더 영역에 마우스 올리면 자동 슬라이드 정지
    addSafeEventListener(domCache.artistSliderContainer, 'mouseenter', () => {
      this.stopAutoSlide();
    });

    // 슬라이더 영역에서 마우스 나가면 자동 슬라이드 재시작
    addSafeEventListener(domCache.artistSliderContainer, 'mouseleave', () => {
      this.startAutoSlide();
    });

    // 페이지 가시성 변경 이벤트
    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.stopAutoSlide();
      } else {
        this.startAutoSlide();
      }
    };
    addSafeEventListener(document, 'visibilitychange', handleVisibilityChange);
  },

  destroy() {
    this.stopAutoSlide();
    this.clearDim();
  }
};

 // ========== 시설안내 자동 슬라이더 클래스 (지연 로딩 최적화) ==========
class AutoImageSlider {
  constructor(container, options = {}) {
    this.container = container;
    this.images = Array.from(container.querySelectorAll('.slide_image'));
    this.currentIndex = 0;
    this.intervalId = null;
    this.isDestroyed = false;

    this.options = {
      interval: options.interval ?? 3500, // 자동 전환 간격(ms)
      fadeSpeed: options.fadeSpeed ?? 1200, // CSS 전환 속도와 맞추면 부드러움
      pauseOnHover: options.pauseOnHover !== false, // 기본: 호버 시 일시정지
      ...options
    };

    this.cleanupHandlers = [];
    this.init();
  }

  init() {
    if (this.images.length <= 1) {
      // 이미지 1장 이하면 초기만 보여주고 종료
      if (this.images[0]) {
        const dataSrc = this.images[0].getAttribute('data-src');
        if (dataSrc && !this.images[0].src) {
          this.images[0].src = dataSrc;
          this.images[0].removeAttribute('data-src');
        }
        this.images[0].classList.add('loaded', 'active');
      }
      return;
    }

    this.setupImages();
    this.setupEventListeners();
    // 자동 재생은 뷰포트 진입 시(startAutoPlay)에서만 시작 (외부 옵저버가 호출)
  }

  setupImages() {
    this.images.forEach((img, index) => {
      // 지연 로딩 처리
      const dataSrc = img.getAttribute('data-src');
      if (dataSrc && !img.src) {
        img.src = dataSrc;
        img.removeAttribute('data-src');
      }

      const handleLoad = () => {
        if (!this.isDestroyed) img.classList.add('loaded');
      };

      if (img.complete && img.naturalWidth > 0) {
        handleLoad();
      } else {
        img.addEventListener('load', handleLoad);
        img.addEventListener('error', () => {
          console.warn('Image failed to load:', img.src);
        });
        this.cleanupHandlers.push(() => {
          img.removeEventListener('load', handleLoad);
        });
      }

      if (index === 0) img.classList.add('active');
      else img.classList.remove('active');
    });
  }

  nextImage() {
    if (this.images.length === 0 || this.isDestroyed) return;

    const current = this.images[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    const next = this.images[this.currentIndex];

    current && current.classList.remove('active');
    next && next.classList.add('active');
  }

  startAutoPlay() {
    this.stopAutoPlay(); // 중복 방지
    if (this.isDestroyed || this.images.length <= 1) return;

    // 첫 시작 시 이미지를 확실히 로드해 두면 첫 전환이 깔끔
    const preloadNext = this.images[(this.currentIndex + 1) % this.images.length];
    if (preloadNext) {
      const dataSrc = preloadNext.getAttribute('data-src');
      if (dataSrc && !preloadNext.src) {
        preloadNext.src = dataSrc;
        preloadNext.removeAttribute('data-src');
      }
    }

    this.intervalId = setInterval(() => this.nextImage(), this.options.interval);
  }

  stopAutoPlay() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setupEventListeners() {
    if (this.options.pauseOnHover) {
      const onEnter = () => this.stopAutoPlay();
      const onLeave = () => this.startAutoPlay();
      this.container.addEventListener('mouseenter', onEnter);
      this.container.addEventListener('mouseleave', onLeave);
      this.cleanupHandlers.push(() => {
        this.container.removeEventListener('mouseenter', onEnter);
        this.container.removeEventListener('mouseleave', onLeave);
      });
    }

    const onVisibility = () => {
      if (document.hidden) this.stopAutoPlay();
      else this.startAutoPlay();
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanupHandlers.push(() => {
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  destroy() {
    this.isDestroyed = true;
    this.stopAutoPlay();
    this.cleanupHandlers.forEach((fn) => fn());
    this.cleanupHandlers = [];
  }
}

// ========== 섹션 뷰포트 진입 시 슬라이더 시작/정지 (트리거) ==========
// data-slider 속성이 붙은 컨테이너를 찾아 슬라이더 인스턴스를 만든 뒤,
// 뷰포트에 들어오면 startAutoPlay, 나가면 stopAutoPlay 하도록 처리
(function initFacilitySliders() {
  const containers = document.querySelectorAll('[data-slider]');
  if (!containers.length) return;

  // 디버깅/관리용으로 window에 노출(선택)
  window.debugArtzipy = window.debugArtzipy || {};
  window.debugArtzipy.sliderInstances = window.debugArtzipy.sliderInstances || [];

  const instances = [];
  containers.forEach((el) => {
    const ins = new AutoImageSlider(el, {
      interval: 3500,
      fadeSpeed: 1200,
      pauseOnHover: true
    });
    instances.push(ins);
  });
  window.debugArtzipy.sliderInstances = instances;

  // 👉 트리거 지점 ("제목 근처에서 바로 시작") 조절: rootMargin/threshold 조정
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const target = entry.target;
      const ins = instances.find(i => i.container === target);
      if (!ins) return;

      if (entry.isIntersecting) ins.startAutoPlay();
      else ins.stopAutoPlay();
    });
  }, {
    // 화면 상단에서 약간(10%) 내려왔을 때 시작하도록 위쪽을 살짝 줄임
    // 더 빨리 시작하려면 top을 더 음수로(-20% 등), 더 늦게는 0이나 양수 px로
    rootMargin: '-10% 0px -70% 0px',
    threshold: 0.15
  });

  containers.forEach((el) => observer.observe(el));
})();


  // ========== 뉴스레터/상품 슬라이더 클래스 ==========
  class SimpleSlider {
    constructor(wrapperSelector, options = {}) {
      this.wrapper = safeQuerySelector(wrapperSelector);
      if (!this.wrapper) {
        console.warn(`Slider wrapper not found: ${wrapperSelector}`);
        return;
      }
      
      this.track = this.wrapper.querySelector('.slider_track');
      this.items = this.track?.querySelectorAll('.newsletter_item, .product_item') || [];
      this.prevBtn = this.wrapper.querySelector('.slider_arrow.prev');
      this.nextBtn = this.wrapper.querySelector('.slider_arrow.next');
      
      this.options = {
        itemsToShow: 4,
        itemWidth: 313,
        itemGap: 23,
        animationDuration: 500,
        ...options
      };
      
      this.currentIndex = 0;
      this.maxIndex = Math.max(0, this.items.length - this.options.itemsToShow);
      
      this.init();
    }
    
    init() {
      if (!this.track) {
        console.warn('Slider track not found');
        return;
      }

      if (this.items.length <= this.options.itemsToShow) {
        this.hideArrows();
        return;
      }
      
      this.setupEventListeners();
      this.updateSliderPosition();
      this.updateArrowStates();
    }
    
    setupEventListeners() {
      if (this.prevBtn) {
        addSafeEventListener(this.prevBtn, 'click', () => {
          this.slideToPrev();
        });
      }
      
      if (this.nextBtn) {
        addSafeEventListener(this.nextBtn, 'click', () => {
          this.slideToNext();
        });
      }
      
      const handleResize = debounce(() => {
        this.updateSliderPosition();
      }, 250);
      
      addSafeEventListener(window, 'resize', handleResize);

      addSafeEventListener(this.wrapper, 'keydown', (e) => {
        if (e.target.closest('.slider_arrow')) {
          switch(e.key) {
            case 'ArrowLeft':
              e.preventDefault();
              this.slideToPrev();
              break;
            case 'ArrowRight':
              e.preventDefault();
              this.slideToNext();
              break;
          }
        }
      });
    }
    
    slideToNext() {
      if (this.currentIndex < this.maxIndex) {
        this.currentIndex++;
        this.updateSliderPosition();
        this.updateArrowStates();
      }
    }
    
    slideToPrev() {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.updateSliderPosition();
        this.updateArrowStates();
      }
    }
    
    updateSliderPosition() {
      if (!this.track) return;
      
      const moveDistance = (this.options.itemWidth + this.options.itemGap) * this.currentIndex;
      this.track.style.transform = `translateX(-${moveDistance}px)`;
    }
    
    updateArrowStates() {
      if (this.prevBtn) {
        const isDisabled = this.currentIndex === 0;
        this.prevBtn.disabled = isDisabled;
        this.prevBtn.style.opacity = isDisabled ? '0.3' : '1';
        this.prevBtn.setAttribute('aria-disabled', isDisabled);
      }
      
      if (this.nextBtn) {
        const isDisabled = this.currentIndex >= this.maxIndex;
        this.nextBtn.disabled = isDisabled;
        this.nextBtn.style.opacity = isDisabled ? '0.3' : '1';
        this.nextBtn.setAttribute('aria-disabled', isDisabled);
      }
    }
    
    hideArrows() {
      if (this.prevBtn) this.prevBtn.style.display = 'none';
      if (this.nextBtn) this.nextBtn.style.display = 'none';
    }
    
    goToSlide(index) {
      this.currentIndex = Math.max(0, Math.min(index, this.maxIndex));
      this.updateSliderPosition();
      this.updateArrowStates();
    }
    
    destroy() {
    }
  }

  // ========== 로고 모달 모듈 ==========
  const LogoModal = {
    isModalOpen: false,
    isAnimating: false,

    init() {
      if (!domCache.logoSection || !domCache.logoModal) {
        console.warn('Logo modal elements not found');
        return;
      }

      this.bindEvents();
    },

    bindEvents() {
      addSafeEventListener(domCache.logoSection, 'click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openModal();
      });

      if (domCache.modalImage) {
        addSafeEventListener(domCache.modalImage, 'click', (e) => {
          e.stopPropagation();
          this.closeModal();
        });
      }

      addSafeEventListener(domCache.logoModal, 'click', (e) => {
        if (e.target === domCache.logoModal) {
          this.closeModal();
        }
      });

      const handleKeydown = (e) => {
        if (this.isModalOpen && ['Escape', 'Enter', ' '].includes(e.key)) {
          e.preventDefault();
          this.closeModal();
        }
      };
      
      addSafeEventListener(document, 'keydown', handleKeydown);

      const handleScroll = (e) => {
        if (this.isModalOpen) {
          e.preventDefault();
          this.closeModal();
        }
      };

      addSafeEventListener(document, 'wheel', handleScroll, { passive: false });
      addSafeEventListener(document, 'touchmove', handleScroll, { passive: false });

      addSafeEventListener(window, 'resize', () => {
        if (this.isModalOpen && window.innerWidth <= 768) {
          this.closeModal();
        }
      });
    },

    openModal() {
      if (this.isModalOpen || this.isAnimating) return;
      
      if (window.innerWidth <= 768) return;
      
      console.log('🎨 로고 모달 열기');
      
      this.isAnimating = true;
      this.isModalOpen = true;
      
      domCache.body.classList.add('modal-open');
      
      domCache.logoModal.classList.add('active');
      
      domCache.logoModal.setAttribute('aria-hidden', 'false');
      domCache.modalImage?.focus();
      
      setTimeout(() => {
        this.isAnimating = false;
      }, 1000);
    },

    closeModal() {
      if (!this.isModalOpen || this.isAnimating) return;
      
      console.log('✌ 로고 모달 닫기');
      
      this.isAnimating = true;
      this.isModalOpen = false;
      
      domCache.logoModal.classList.remove('active');
      
      domCache.body.classList.remove('modal-open');
      
      domCache.logoModal.setAttribute('aria-hidden', 'true');
      domCache.logoSection?.focus();
      
      setTimeout(() => {
        this.isAnimating = false;
      }, 1000);
    },

    getStatus() {
      return {
        isOpen: this.isModalOpen,
        isAnimating: this.isAnimating,
        screenWidth: window.innerWidth,
        isMobile: window.innerWidth <= 768
      };
    }
  };

  // ========== 개선된 스크롤 애니메이션 모듈 (IntersectionObserver 사용) ==========
  const ScrollAnimation = {
    animationObserver: null,

    init() {
      this.setupAnimationObserver();
    },

    setupAnimationObserver() {
      // IntersectionObserver를 사용하여 요소가 뷰포트에 들어오는 순간 애니메이션 트리거
      this.animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const element = entry.target;
          
          if (entry.isIntersecting) {
            // 요소가 화면에 들어오면 애니메이션 시작
            if (!element.classList.contains('animate-visible')) {
              element.classList.add('animate-visible');
              console.log('🎬 스크롤 애니메이션 시작:', element.className);
            }
          } else {
            // 요소가 화면에서 벗어나면 애니메이션 클래스 제거 (반복 실행을 위해)
            if (element.classList.contains('animate-visible')) {
              element.classList.remove('animate-visible');
              console.log('🔄 스크롤 애니메이션 리셋:', element.className);
            }
          }
        });
      }, {
        // rootMargin: 요소가 뷰포트에 들어오기 전에 미리 애니메이션 시작
        // 300px 0px: 요소가 화면 하단 300px 전에 미리 감지하여 자연스럽게 애니메이션 시작
        rootMargin: '300px 0px',
        // threshold: 요소가 30% 보여질 때 트리거 (0.3 = 30%)
        // 값이 클수록 더 늦게 애니메이션 시작 (0.1=10%, 0.5=50%, 1.0=100%)
        threshold: 0.3
      });

      // .animate-slide-left와 .animate-slide-right 클래스를 가진 모든 요소 관찰
      domCache.animateElements.forEach(element => {
        this.animationObserver.observe(element);
      });
    },

    destroy() {
      if (this.animationObserver) {
        this.animationObserver.disconnect();
        this.animationObserver = null;
      }
    }
  };

  // ========== 전역 정리 함수 ==========
  function cleanup() {
    console.log('🧹 이벤트 리스너 정리 중...');
    
    if (BannerSlider && typeof BannerSlider.destroy === 'function') {
      BannerSlider.destroy();
    }
    
    if (ArtistStackSlider && typeof ArtistStackSlider.destroy === 'function') {
      ArtistStackSlider.destroy();
    }

    if (LazyLoader && typeof LazyLoader.destroy === 'function') {
      LazyLoader.destroy();
    }

    if (ScrollAnimation && typeof ScrollAnimation.destroy === 'function') {
      ScrollAnimation.destroy();
    }
    
    cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('이벤트 리스너 정리 중 오류:', error);
      }
    });
    
    cleanupFunctions.length = 0;
  }

  // ========== 메인 초기화 함수 ==========
  function initializeApp() {
    try {
      console.log('🚀 아트지피 홈페이지 초기화 시작...');
      
      cacheDOMElements();

      // 지연 로딩 모듈을 가장 먼저 초기화
      LazyLoader.init();

      Navigation.init();
      BannerSlider.init();
      ArtistStackSlider.init();
      LogoModal.init();
      
      // 개선된 스크롤 애니메이션 초기화
      ScrollAnimation.init();

      const sliderInstances = [];
      domCache.sliderContainers.forEach(container => {
        const sliderType = container.getAttribute('data-slider');
        
        let options = {
          interval: 3500,
          fadeSpeed: 1200,
          pauseOnHover: true
        };
        
        switch(sliderType) {
          case 'creation':
            options.interval = 3500;
            break;
          case 'storage':
            options.interval = 4000;
            break;
          case 'gallery':
            options.interval = 3000;
            break;
          case 'sales':
            options.interval = 3500;
            break;
        }
        
        const sliderInstance = new AutoImageSlider(container, options);
        sliderInstances.push(sliderInstance);
      });

      const sliderConfig = {
        itemsToShow: 4,
        itemWidth: 313,
        itemGap: 23,
        animationDuration: 500
      };
      
      const newsletterSlider = new SimpleSlider('#newsletterSlider', sliderConfig);
      const productsSlider = new SimpleSlider('#productsSlider', sliderConfig);

      addSafeEventListener(window, 'beforeunload', () => {
        sliderInstances.forEach(instance => {
          if (instance && typeof instance.destroy === 'function') {
            instance.destroy();
          }
        });
        
        cleanup();
      });

      if (typeof window !== 'undefined') {
        window.debugArtzipy = {
          navigation: Navigation,
          bannerSlider: BannerSlider,
          artistStackSlider: ArtistStackSlider,
          logoModal: LogoModal,
          scrollAnimation: ScrollAnimation,
          lazyLoader: LazyLoader,
          newsletterSlider,
          productsSlider,
          sliderInstances,
          cleanup,
          getStatus: () => ({
            banner: BannerSlider.currentIndex,
            artistStack: {
              currentOrder: ArtistStackSlider.cardOrder,
              isAnimating: ArtistStackSlider.isAnimating
            },
            modal: LogoModal.getStatus(),
            sliders: {
              newsletter: newsletterSlider?.currentIndex || 0,
              products: productsSlider?.currentIndex || 0
            },
            memoryStatus: {
              cleanupFunctions: cleanupFunctions.length,
              sliderInstances: sliderInstances.length,
              animateElements: domCache.animateElements?.length || 0
            },
            lazyLoading: {
              featureCards: domCache.featureCards?.length || 0,
              artistCards: domCache.artistCardsLazy?.length || 0,
              lazyImages: domCache.lazyImages?.length || 0
            },
            animationObserver: {
              isActive: ScrollAnimation.animationObserver !== null,
              observedElements: domCache.animateElements?.length || 0
            }
          })
        };
      }

      console.log('✅ 아트지피 홈페이지 초기화 완료!');
      console.log('🎨 스택 슬라이더 초기화 완료!');
      console.log('⚡ 지연 로딩 최적화 적용 완료!');
      console.log('🎬 개선된 스크롤 애니메이션 적용 완료!');
      console.log('🔧 디버깅: window.debugArtzipy.getStatus() 로 상태 확인 가능');

    } catch (error) {
      console.error('✌ 초기화 중 오류 발생:', error);
    }
  }

  // ========== 페이지 로드 완료 시 초기화 ==========
  if (document.readyState === 'loading') {
    addSafeEventListener(document, 'DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

})();