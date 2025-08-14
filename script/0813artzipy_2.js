/*************************************************
 * 아트지피 홈페이지 JavaScript - 스택 슬라이더 통합버전
 * 주요 기능:
 * - 네비게이션 스무스 스크롤 & 활성 메뉴
 * - 메인 배너 슬라이더 (텍스트 동기화)
 * - 이달의 작가 스택 슬라이더
 * - 시설안내 자동 이미지 슬라이더 + 스크롤 애니메이션 (반복 실행)
 * - 뉴스레터/상품 슬라이더
 * - 로고 클릭 모달
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
        
        animateElements: document.querySelectorAll('.animate-slide-left, .animate-slide-right')
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

  // ========== 배너 슬라이더 모듈 ==========
  const BannerSlider = {
    currentIndex: 0,
    slides: [],
    dots: [],
    timer: null,
    isPlaying: true,
    isUserPaused: false,

    bannerTexts: [
      { 
        title: 'Artzipy', 
        subtitle: 'Artistic Vision', 
        description: '창작부터 판매까지, 모든 것이 하나의 플랫폼에서 이루어지는 아트공간' 
      },
      { 
        title: 'Creative Space', 
        subtitle: 'Inspired',
        description: '창작부터 판매까지, 모든 것이 하나의 플랫폼에서 이루어지는 아트공간' 
      },
      { 
        title: 'Smart Archive', 
        subtitle: 'Secured',
        description: '창작부터 판매까지, 모든 것이 하나의 플랫폼에서 이루어지는 아트공간' 
      },
      { 
        title: 'Gallery', 
        subtitle: 'Curated',
        description: '창작부터 판매까지, 모든 것이 하나의 플랫폼에서 이루어지는 아트공간' 
      },
      { 
        title: 'Art Commerce', 
        subtitle: 'Simplified',
        description: '창작부터 판매까지, 모든 것이 하나의 플랫폼에서 이루어지는 아트공간' 
      }
    ],

    defaultBannerImages: ['b1.png', 'b2.png', 'b3.png', 'b4.png', 'b5.png'],

    init() {
      if (!domCache.banner) {
        console.warn('Banner element not found');
        return;
      }

      this.setupSlides();
      this.createDots();
      this.bindEvents();
      this.start();
    },

    setupSlides() {
      this.slides = Array.from(domCache.banner.querySelectorAll('.banner_slide'));
      
      this.slides.forEach((slide, index) => {
        const bgImage = slide.getAttribute('data-bg');
        if (bgImage) {
          slide.style.backgroundImage = `url('${bgImage}')`;
        }
      });

      if (this.slides.length === 0) {
        this.createDefaultSlides();
        this.slides = Array.from(domCache.banner.querySelectorAll('.banner_slide'));
      }

      if (this.slides.length > 0) {
        this.slides[0].classList.add('active');
      }
    },

    createDefaultSlides() {
      let slidesWrap = domCache.bannerSlides;
      if (!slidesWrap) {
        slidesWrap = document.createElement('div');
        slidesWrap.className = 'banner_slides';
        domCache.banner.appendChild(slidesWrap);
        domCache.bannerSlides = slidesWrap;
      }
      
      this.defaultBannerImages.forEach((name, index) => {
        const div = document.createElement('div');
        div.className = 'banner_slide';
        if (index === 0) div.classList.add('active');
        div.style.backgroundImage = `url('./images/${name}')`;
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
        if (e.target.closest('.banner_arrow') || e.target.closest('.banner_dots')) {
          return;
        }
        
        this.togglePlay();
      });

      const handleVisibilityChange = () => {
        if (document.hidden) {
          this.stop();
        } else if (!this.isUserPaused) {
          this.start();
        }
      };
      
      addSafeEventListener(document, 'visibilitychange', handleVisibilityChange);

      addSafeEventListener(domCache.banner, 'keydown', (e) => {
        switch(e.key) {
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

      this.slides[this.currentIndex]?.classList.remove('active');
      this.dots[this.currentIndex]?.classList.remove('active');

      this.currentIndex = index;
      this.slides[this.currentIndex]?.classList.add('active');
      this.dots[this.currentIndex]?.classList.add('active');

      this.updateBannerText(this.currentIndex);
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

  // ========== 이달의 작가 스택 슬라이더 모듈 ==========
  const ArtistStackSlider = {
    cardElements: null,
    totalCards: 0,
    slideInterval: null,
    isAnimating: false,
    cardOrder: [0, 1, 2, 3, 4],
    positionClasses: ['artist_position_0', 'artist_position_1', 'artist_position_2', 'artist_position_3', 'artist_position_4'],

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
      this.startAutoSlide();
    },

    initializeCards() {
      this.cardElements.forEach((card, index) => {
        // 초기 위치 클래스 적용
        card.classList.add(this.positionClasses[index]);
        card.setAttribute('data-card-index', index);
      });
    },

    updateCardPositions() {
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
      
      // 왼쪽1(position_3)에 있는 카드를 가운데로 이동
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
      }, 800);
    },

    moveToPrevSlide() {
      if (this.isAnimating) return;
      
      this.isAnimating = true;
      
      // 모든 카드에 트랜지션 클래스 추가
      this.cardElements.forEach(card => {
        card.classList.add('transitioning');
      });
      
      // 오른쪽1(position_1)에 있는 카드를 가운데로 이동
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
      }, 800);
    },

    startAutoSlide() {
      this.stopAutoSlide();
      this.slideInterval = setInterval(() => {
        this.moveToNextSlide();
      }, 3000);
    },

    stopAutoSlide() {
      if (this.slideInterval) {
        clearInterval(this.slideInterval);
        this.slideInterval = null;
      }
    },

    bindEvents() {
      // 마우스 이벤트 처리 (자동 슬라이드 정지/시작만)
      addSafeEventListener(domCache.artistSliderContainer, 'mouseenter', () => {
        this.stopAutoSlide();
      });

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
    }
  };

  // ========== 시설안내 자동 슬라이더 클래스 ==========
  class AutoImageSlider {
    constructor(container, options = {}) {
      this.container = container;
      this.images = container.querySelectorAll('.slide_image');
      this.currentIndex = 0;
      this.intervalId = null;
      this.isDestroyed = false;
      
      this.options = {
        interval: options.interval || 3500,
        fadeSpeed: options.fadeSpeed || 1200,
        pauseOnHover: options.pauseOnHover !== false,
        ...options
      };
      
      this.init();
    }
    
    init() {
      if (this.images.length <= 1) return;
      
      this.setupImages();
      this.startAutoPlay();
      this.setupEventListeners();
    }
    
    setupImages() {
      this.images.forEach((img, index) => {
        const handleLoad = () => {
          if (!this.isDestroyed) {
            img.classList.add('loaded');
          }
        };

        if (img.complete) {
          handleLoad();
        } else {
          img.addEventListener('load', handleLoad);
          img.addEventListener('error', () => {
            console.warn('Image failed to load:', img.src);
          });
        }
        
        if (index === 0) {
          img.classList.add('active');
        } else {
          img.classList.remove('active');
        }
      });
    }
    
    nextImage() {
      if (this.images.length === 0 || this.isDestroyed) return;

      const currentImage = this.images[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.images.length;
      const nextImage = this.images[this.currentIndex];
      
      currentImage?.classList.remove('active');
      nextImage?.classList.add('active');
    }
    
    startAutoPlay() {
      this.stopAutoPlay();
      
      if (this.isDestroyed) return;
      
      this.intervalId = setInterval(() => {
        this.nextImage();
      }, this.options.interval);
    }
    
    stopAutoPlay() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
    
    setupEventListeners() {
      if (this.options.pauseOnHover) {
        const handleMouseEnter = () => {
          this.stopAutoPlay();
        };
        
        const handleMouseLeave = () => {
          this.startAutoPlay();
        };
        
        this.container.addEventListener('mouseenter', handleMouseEnter);
        this.container.addEventListener('mouseleave', handleMouseLeave);
        
        this.cleanupHandlers = [
          () => this.container.removeEventListener('mouseenter', handleMouseEnter),
          () => this.container.removeEventListener('mouseleave', handleMouseLeave)
        ];
      }
      
      const handleVisibilityChange = () => {
        if (document.hidden) {
          this.stopAutoPlay();
        } else {
          this.startAutoPlay();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      if (!this.cleanupHandlers) {
        this.cleanupHandlers = [];
      }
      this.cleanupHandlers.push(
        () => document.removeEventListener('visibilitychange', handleVisibilityChange)
      );
    }
    
    destroy() {
      this.isDestroyed = true;
      this.stopAutoPlay();
      if (this.cleanupHandlers) {
        this.cleanupHandlers.forEach(cleanup => cleanup());
        this.cleanupHandlers = [];
      }
    }
  }

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
      
      console.log('❌ 로고 모달 닫기');
      
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

  // ========== 스크롤 애니메이션 모듈 (반복 실행) ==========
  const ScrollAnimation = {
    init() {
      this.bindScrollEvents();
    },

    bindScrollEvents() {
      const throttledScroll = throttle(this.handleScroll.bind(this), 100);
      addSafeEventListener(window, 'scroll', throttledScroll);
      
      this.handleScroll();
    },

    handleScroll() {
      const windowHeight = window.innerHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      domCache.animateElements.forEach(element => {
        const elementTop = element.offsetTop;
        const elementHeight = element.offsetHeight;
        const elementBottom = elementTop + elementHeight;
        
        // 트리거 포인트: 요소가 화면 하단 75% 지점에 도달할 때
        const triggerPoint = scrollTop + windowHeight * 0.75;
        
        // 요소가 완전히 화면 위로 벗어났는지 확인하는 포인트
        const exitPoint = scrollTop + windowHeight * 0.1;
        
        // 요소가 화면에 진입했을 때 애니메이션 실행
        if (triggerPoint > elementTop && scrollTop < elementBottom) {
          if (!element.classList.contains('animate-visible')) {
            element.classList.add('animate-visible');
            console.log('🎬 스크롤 애니메이션 시작:', element.className);
          }
        } 
        // 요소가 화면에서 완전히 벗어났을 때 애니메이션 클래스 제거
        else if (exitPoint < elementTop || scrollTop > elementBottom + windowHeight * 0.5) {
          if (element.classList.contains('animate-visible')) {
            element.classList.remove('animate-visible');
            console.log('🔄 스크롤 애니메이션 리셋:', element.className);
          }
        }
      });
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

      Navigation.init();
      BannerSlider.init();
      ArtistStackSlider.init();
      LogoModal.init();
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
            }
          })
        };
      }

      console.log('✅ 아트지피 홈페이지 초기화 완료!');
      console.log('🎨 스택 슬라이더 초기화 완료!');
      console.log('🔧 디버깅: window.debugArtzipy.getStatus() 로 상태 확인 가능');

    } catch (error) {
      console.error('❌ 초기화 중 오류 발생:', error);
    }
  }

  // ========== 페이지 로드 완료 시 초기화 ==========
  if (document.readyState === 'loading') {
    addSafeEventListener(document, 'DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

})();