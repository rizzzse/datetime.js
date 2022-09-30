import { modulo } from "emnorst";
import { DateTimeRange, IDuration } from "./duration";

export interface IDate {
    year: number;
    month: number;
    day: number;
}

export const normalizeDate = (date: IDate): IDate => {
    let day = date.day;
    let month = modulo(date.month, monthsInYear) || monthsInYear;
    let year = date.year + Math.floor((date.month - 1) / monthsInYear);
    while(day > daysInMonth(year, month)) {
        day -= daysInMonth(year, month);
        month++;
        if(month > monthsInYear) {
            month = 1;
            year++;
        }
    }
    while(day <= 0) {
        month--;
        if(month < 1) {
            month = monthsInYear;
            year--;
        }
        day += daysInMonth(year, month);
    }
    return { day, month, year };
};

export interface ITime {
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
}

export const normalizeTime = (time: ITime): ITime => {
    const millisecond = time.millisecond;
    const second = time.second + Math.floor(millisecond / millisInSecond);
    const minute = time.minute + Math.floor(second / secondsInMinute);
    const hour = time.hour + Math.floor(minute / minutesInHour);
    return {
        hour,
        minute: modulo(minute, minutesInHour),
        second: modulo(second, secondsInMinute),
        millisecond: modulo(millisecond, millisInSecond),
    };
};

export interface IDateTime extends IDate, ITime {}

const normalizeDateTime = (dt: IDateTime) => {
    const time = normalizeTime(dt);
    const date = normalizeDate({
        day: dt.day + Math.floor(time.hour / hoursInDay),
        month: dt.month,
        year: dt.year,
    });
    // @ts-expect-error
    return new DateTime(
        date.year,
        date.month,
        date.day,
        modulo(time.hour, hoursInDay),
        time.minute,
        time.second,
        time.millisecond,
    );
};

export class DateTime implements IDateTime {
    static range(
        start: DateTime | string | number | Date,
        end: DateTime | string | number | Date,
    ): DateTimeRange {
        if(!(start instanceof DateTime)) {
            start = DateTime.from(start);
        }
        if(!(end instanceof DateTime)) {
            end = DateTime.from(end);
        }
        return new DateTimeRange(start, end);
    }
    static now(): DateTime {
        return DateTime.from(Date.now());
    }
    static from(source: string | number | Date): DateTime {
        if(typeof source === "string" || typeof source === "number") {
            source = new Date(source);
        }
        if(source instanceof Date) {
            return new DateTime(
                source.getUTCFullYear(),
                source.getUTCMonth() + 1,
                source.getUTCDate(),
                source.getUTCHours(),
                source.getUTCMinutes(),
                source.getUTCSeconds(),
                source.getUTCMilliseconds(),
            );
        }
        // @ts-expect-error
        const _: never = source;
        throw new TypeError("unknown source type.");
    }
    private constructor(
        readonly year: number,
        readonly month: number,
        readonly day: number,
        readonly hour: number,
        readonly minute: number,
        readonly second: number,
        readonly millisecond: number,
    ) {}
    with(dt: Partial<IDateTime>): DateTime {
        return normalizeDateTime({
            year:        dt.year        ?? this.year,
            month:       dt.month       ?? this.month,
            day:         dt.day         ?? this.day,
            hour:        dt.hour        ?? this.hour,
            minute:      dt.minute      ?? this.minute,
            second:      dt.second      ?? this.second,
            millisecond: dt.millisecond ?? this.millisecond,
        });
    }
    plus(dur: Partial<IDuration>): DateTime {
        return normalizeDateTime({
            year:        this.year        + (dur.years        ?? 0),
            month:       this.month       + (dur.months       ?? 0),
            day:         this.day         + (dur.days         ?? 0),
            hour:        this.hour        + (dur.hours        ?? 0),
            minute:      this.minute      + (dur.minutes      ?? 0),
            second:      this.second      + (dur.seconds      ?? 0),
            millisecond: this.millisecond + (dur.milliseconds ?? 0),
        });
    }
    startOf(key: Exclude<keyof IDateTime, "offset" | "millisecond"> | "week"): DateTime {
        const dt: Partial<IDateTime> = { millisecond: 0 };
        if(key === "week") {
            dt.day = this.day - weekday(this);
            key = "day";
        }
        block: {
            if(key === "second") break block;
            dt.second = 0;
            if(key === "minute") break block;
            dt.minute = 0;
            if(key === "hour") break block;
            dt.hour = 0;
            if(key === "day") break block;
            dt.day = 1;
            if(key === "month") break block;
            dt.month = 1;
        }
        return this.with(dt);
    }
    endOf(key: Exclude<keyof IDateTime, "offset" | "millisecond"> | "week") {
        const start = this.startOf(key);
        if(key === "week") {
            return start.plus({ days: 7, milliseconds: -1 });
        } else {
            return start.plus({ [key + "s"]: 1, milliseconds: -1 });
        }
    }
}

export type WeekdayFullString = `${typeof weekDayStringArray[number]}day`;
export type WeekdayString = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

const weekDayStringArray = ["Sun", "Mon", "Tues", "Wednes", "Thurs", "Fri", "Satur"] as const;

export const weekdayString: {
    (date: IDate, full: true): WeekdayFullString;
    (date: IDate, full?: false): WeekdayString;
} = (date: IDate, full = false): never => {
    const base = weekDayStringArray[weekday(date)];
    const result: WeekdayString | WeekdayFullString = (
        full ? `${base}day` : base.slice(0, 3) as WeekdayString
    );
    return result as never;
};

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const weekday = (date: IDate): Weekday => {
    const dayFromUnixEpoc = date.year + leapDays(date.year - 1) + yearday(date);
    return dayFromUnixEpoc % daysInWeek as Weekday;
};

export const yearday = (date: IDate): number => {
    // this.month が
    //   1 ならば 13
    //   2 ならば 14
    //   それ以外ならば this.month
    // それに + 1 する
    const m = (date.month + 9) % 12 + 4;
    // fairfieldの公式
    // -64 === -122 + 31(1月の日数) + 28(2月の日数) - 1(dayが1から始まるため、1月1日を0とする調整)
    const dayOfYearWithoutLeapDay = ((306 * m / 10 | 0) - 64 + date.day) % daysInYear;

    const leapDay = +(date.month > 2 && isLeapYear(date.year));
    return dayOfYearWithoutLeapDay + leapDay;
};

export const isLeapYear = (year: number): boolean => {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
};

export const leapDays = (year: number): number => {
    return (year / 4 | 0) - (year / 100 | 0) + (year / 400 | 0);
};

export type DaysInMonth = 28 | 29 | 30 | 31;

const daysInMonthArray = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export const daysInMonth = (year: number, month: number): DaysInMonth => {
    const leapDay = +(month === 2 && isLeapYear(year));
    return daysInMonthArray[month - 1] + leapDay as DaysInMonth;
};

export const daysInYear = 365;
export const daysInWeek = 7;
export const monthsInYear = 12;

export const hoursInDay = 24;
export const minutesInHour = 60;
export const secondsInMinute = 60;
export const millisInSecond = 1000;
