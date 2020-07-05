/* eslint-disable class-methods-use-this */
import Card from './Card';
import { mySwiper, settings, dataController } from './constants';
import 'materialize-css';
import { updateMaterialComponents, setProgressbarToCurrentPosition, getApproprateWords, saveTrainingStatistics, } from './helpers';

export default class Training {
  constructor(newWordsAmountPerDay, maxWordsPerDay) {
    console.log(newWordsAmountPerDay, maxWordsPerDay)
    this.shortTermStat = {
      date: new Date().toDateString(),
      totalCards: 0,
      wrightAnswers: 0,
      newWords:0,
      chain: 0,
      longestChain:0,
    }
    settings.lastTrain = new Date().toDateString();
    dataController.setUserOptions({name: 'Mr Checker', settings});

    getApproprateWords(newWordsAmountPerDay, maxWordsPerDay).then((res)=> {
      this.words = res;
      console.log(res);
      this.start();
    })

    window.addEventListener('unload', saveTrainingStatistics);
  }

  start() {
    if (this.words.length) {
      this.words.forEach((word) => {
        const card = new Card(word);
        mySwiper.appendSlide(card.cardElem);
      });
      mySwiper.update();      
      updateMaterialComponents();
      this.playNextCard();
    }
  }

  playNextCard() {
    const currentForm = mySwiper.slides[mySwiper.activeIndex].querySelector('.form');
    const currentInput = currentForm.querySelector('.input_text');

    mySwiper.allowSlideNext = false;
    mySwiper.navigation.nextEl.classList.add('swiper-button-disabled');
    setProgressbarToCurrentPosition();    
    currentInput.focus();
  }

  stop() {
    mySwiper.destroy(false, true);
  }

  updateStat() {
    if (this.shortTermStat.longestChain <  this.shortTermStat.chain) {
      this.shortTermStat.longestChain = this.shortTermStat.chain;
    }    
    document.querySelector('.statistics__new-words-num').innerText = this.shortTermStat.newWords;
    document.querySelector('.statistics__correct-answers').innerText = `${Math.round(this.shortTermStat.wrightAnswers/this.shortTermStat.totalCards*100)}%`;
    document.querySelector('.statistics__total-cards').innerText = this.shortTermStat.totalCards;
    document.querySelector('.statistics__correct-in-row').innerText = this.shortTermStat.longestChain;
    localStorage.setItem('stat', JSON.stringify(this.shortTermStat));
    console.log(this.shortTermStat);
  }

  continueTraining() {
    getApproprateWords(5, 10).then((res)=>{
      res.forEach((word) => {
        const card = new Card(word);
        mySwiper.appendSlide(card.cardElem);
      });
      mySwiper.update();      
      updateMaterialComponents();
      mySwiper.allowSlideNext = true;
      mySwiper.slideNext();
      this.playNextCard();
    })
  }   
}
