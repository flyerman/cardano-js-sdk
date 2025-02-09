import { Observable, ReplaySubject, Subscription } from 'rxjs';

export interface BehaviorObservable<T> extends Observable<T> {
  get value(): T | null;
}

export class TrackerSubject<T> extends ReplaySubject<T> implements BehaviorObservable<T> {
  #sourceSubscription$: Subscription;
  #value: T | null = null;
  get value(): T | null {
    return this.#value;
  }
  constructor(source$: Observable<T>) {
    super(1);
    this.#sourceSubscription$ = source$.subscribe(this);
  }
  next(value: T) {
    this.#value = value;
    super.next(value);
  }
  complete() {
    this.#sourceUnsubscribe();
    super.complete();
  }
  error(err: unknown) {
    this.#sourceUnsubscribe();
    super.error(err);
  }
  unsubscribe() {
    this.#sourceUnsubscribe();
    super.unsubscribe();
  }
  #sourceUnsubscribe() {
    // can be undefined if source observable completes immediatelly upon subscription in constructor
    if (this.#sourceSubscription$) this.#sourceSubscription$.unsubscribe();
  }
}
